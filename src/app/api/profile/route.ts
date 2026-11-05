import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb, getLibsqlClient } from "@/db";
import { profileDetails } from "@/db/schema";
import { getPrincipal } from "@/lib/authorization";
import { profileSchema } from "@/lib/validation";
import { enforceRateLimit, isSameOriginRequest } from "@/lib/rate-limit";

export async function GET(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  const principal = await getPrincipal(request.headers);
  if (!principal) return Response.json({ error: "Sign in to view your account." }, { status: 401 });

  const details = await getDb().query.profileDetails.findFirst({
    where: eq(profileDetails.userId, principal.actor.id),
  });
  return Response.json({
    profile: details ? {
      fullName: principal.actor.name,
      phoneNumber: details.phoneNumber,
      gender: details.gender,
      organization: details.organization,
      currentPosition: details.currentPosition,
      location: details.location,
      createdAt: details.createdAt,
    } : null,
    avatar: details?.avatar ?? null,
    role: principal.actor.role,
    status: "active",
  });
}

export async function POST(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const principal = await getPrincipal(request.headers);
  if (!principal) return Response.json({ error: "Sign in to complete your profile." }, { status: 401 });

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
    where: eq(profileDetails.userId, principal.actor.id),
  });
  const location = Object.hasOwn(parsed.data, "location")
    ? parsed.data.location || null
    : existingDetails?.location ?? null;
  if (existingDetails?.gender && existingDetails.gender !== parsed.data.gender) {
    return Response.json({
      error: "Your saved gender cannot be changed from Account settings.",
      fields: { gender: ["Your saved gender cannot be changed."] },
    }, { status: 409 });
  }

  const now = Date.now();
  await getLibsqlClient().batch([
    {
      sql: `INSERT INTO "profile_details"
        ("userId", "phoneNumber", "gender", "organization", "currentPosition", "location", "createdAt", "updatedAt")
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT("userId") DO UPDATE SET
          "phoneNumber" = excluded."phoneNumber",
          "gender" = excluded."gender",
          "organization" = excluded."organization",
          "currentPosition" = excluded."currentPosition",
          "location" = excluded."location",
          "updatedAt" = excluded."updatedAt"`,
      args: [
        principal.actor.id,
        parsed.data.phoneNumber,
        parsed.data.gender,
        parsed.data.organization,
        parsed.data.currentPosition,
        location,
        now,
        now,
      ],
    },
    {
      sql: `UPDATE "user" SET "name" = ?, "updatedAt" = ? WHERE "id" = ?`,
      args: [parsed.data.fullName, now, principal.actor.id],
    },
    {
      sql: `INSERT INTO "audit_logs" ("id", "userId", "action", "resource", "timestamp")
        VALUES (?, ?, 'profile.updated', 'profile', ?)`,
      args: [randomUUID(), principal.actor.id, now],
    },
  ], "write");

  return Response.json({ success: true });
}
