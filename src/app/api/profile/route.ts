import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { auditLogs, profileDetails, profiles, user } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { profileSchema } from "@/lib/validation";
import { enforceRateLimit, isSameOriginRequest } from "@/lib/rate-limit";

export async function GET(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Sign in to view your account." }, { status: 401 });

  const [profile, details] = await Promise.all([
    getDb().query.profiles.findFirst({
    where: eq(profiles.userId, session.user.id),
    }),
    getDb().query.profileDetails.findFirst({
      where: eq(profileDetails.userId, session.user.id),
    }),
  ]);
  return Response.json({
    profile: profile ? {
      ...profile,
      gender: details?.gender ?? null,
      organization: details?.organization ?? null,
      currentPosition: details?.currentPosition ?? null,
    } : null,
    avatar: details?.avatar ?? null,
  });
}

export async function POST(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Sign in to complete your profile." }, { status: 401 });

  if (!(await enforceRateLimit(request, "profile", 8, 900))) {
    return Response.json({ error: "Too many profile updates. Try again later." }, { status: 429 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Provide a valid profile request." }, { status: 400 });
  }
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({
      error: "Review the profile details and try again.",
      fields: parsed.error.flatten().fieldErrors,
    }, { status: 400 });
  }

  const db = getDb();
  const existingDetails = await db.query.profileDetails.findFirst({
    where: eq(profileDetails.userId, session.user.id),
  });
  if (existingDetails?.gender && existingDetails.gender !== parsed.data.gender) {
    return Response.json({
      error: "Your saved gender cannot be changed from Account settings.",
      fields: { gender: ["Your saved gender cannot be changed."] },
    }, { status: 409 });
  }

  await db.insert(profiles).values({
    id: randomUUID(),
    userId: session.user.id,
    fullName: parsed.data.fullName,
    phoneNumber: parsed.data.phoneNumber,
  }).onConflictDoUpdate({
    target: profiles.userId,
    set: {
      fullName: parsed.data.fullName,
      phoneNumber: parsed.data.phoneNumber,
      updatedAt: new Date(),
    },
  });
  await db.insert(profileDetails).values({
    userId: session.user.id,
    gender: parsed.data.gender,
    organization: parsed.data.organization,
    currentPosition: parsed.data.currentPosition,
  }).onConflictDoUpdate({
    target: profileDetails.userId,
    set: {
      gender: parsed.data.gender,
      organization: parsed.data.organization,
      currentPosition: parsed.data.currentPosition,
      updatedAt: new Date(),
    },
  });
  await db.update(user).set({ name: parsed.data.fullName, updatedAt: new Date() }).where(eq(user.id, session.user.id));
  await db.insert(auditLogs).values({
    id: randomUUID(),
    userId: session.user.id,
    action: "profile.updated",
    resource: "profile",
  });

  return Response.json({ success: true });
}
