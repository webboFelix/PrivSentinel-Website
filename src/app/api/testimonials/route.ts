import { and, avg, count, desc, eq, gte, lte, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { profileDetails, testimonials, user } from "@/db/schema";
import { getPrincipal, recordAudit } from "@/lib/authorization";
import { getServerEnv } from "@/lib/env";
import { enforceRateLimit, isSameOriginRequest } from "@/lib/rate-limit";

export const testimonialSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(100),
  message: z.string().trim().min(20).max(2_000),
  designation: z.string().trim().max(100).optional().transform((value) => value || null),
}).strict();

function errorResponse(code: string, message: string, status = 503) {
  return Response.json({ code, error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  await connection();
  const env = getServerEnv();
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
    return errorResponse("not_configured", "Testimonials are not configured yet. Please check back later.");
  }
  await ensureDatabaseSchema();

  const db = getDb();
  const approved = and(
    eq(testimonials.status, "approved"),
    gte(testimonials.rating, 1),
    lte(testimonials.rating, 5),
    ne(testimonials.title, ""),
    ne(testimonials.quote, ""),
  );
  const [records, [aggregate]] = await Promise.all([
    db.select({
      id: testimonials.id,
      name: user.name,
      fallbackName: testimonials.name,
      avatar: profileDetails.avatar,
      designation: testimonials.designation,
      title: testimonials.title,
      message: testimonials.quote,
      rating: testimonials.rating,
      submittedAt: testimonials.createdAt,
    }).from(testimonials)
      .leftJoin(user, eq(testimonials.userId, user.id))
      .leftJoin(profileDetails, eq(testimonials.userId, profileDetails.userId))
      .where(approved)
      .orderBy(desc(testimonials.approvedAt))
      .limit(12),
    db.select({
      count: count(),
      average: avg(testimonials.rating),
    }).from(testimonials).where(approved),
  ]);
  return Response.json({
    reviews: records.filter((review) =>
      Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5 &&
      review.title.trim().length > 0 && review.message.trim().length > 0,
    ).map(({ fallbackName, ...review }) => ({
      ...review,
      name: review.name || fallbackName || "PrivSentinel user",
    })),
    summary: {
      count: aggregate?.count ?? 0,
      average: Number(aggregate?.average ?? 0),
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const principal = await getPrincipal(request.headers);
  if (!principal) return Response.json({ error: "Sign in to share your experience." }, { status: 401 });
  if (!(await enforceRateLimit(request, `testimonial:${principal.actor.id}`, 5, 3600))) {
    return Response.json({ error: "Too many review submissions. Try again later." }, { status: 429 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Provide a valid testimonial." }, { status: 400 });
  }
  const parsed = testimonialSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({
      error: "Review the rating and testimonial details.",
      fields: parsed.error.flatten().fieldErrors,
    }, { status: 400 });
  }

  const db = getDb();
  const existing = await db.query.testimonials.findFirst({
    columns: { id: true },
    where: eq(testimonials.userId, principal.actor.id),
  });
  if (existing) {
    return Response.json({ error: "You already have a review. Edit your existing submission instead." }, { status: 409 });
  }

  const review = {
    id: randomUUID(),
    name: "PrivSentinel user",
    location: null,
    quote: parsed.data.message,
    title: parsed.data.title,
    userId: principal.actor.id,
    designation: parsed.data.designation,
    status: "pending",
    rating: parsed.data.rating,
    approvedAt: null,
    reviewedBy: null,
    reviewedAt: null,
  } as const;
  await db.insert(testimonials).values(review);
  await recordAudit({
    actorId: principal.actor.id,
    action: "testimonial.submitted",
    resource: "testimonial",
    targetType: "testimonial",
    targetId: review.id,
  });
  return Response.json({
    testimonial: { ...review, submittedAt: new Date().toISOString() },
    status: "pending",
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
