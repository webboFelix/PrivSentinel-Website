import { and, eq } from "drizzle-orm";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { testimonials } from "@/db/schema";
import { getPrincipal, recordAudit } from "@/lib/authorization";
import { enforceRateLimit, isSameOriginRequest } from "@/lib/rate-limit";
import { testimonialSchema } from "../route";

export async function PATCH(request: Request, context: RouteContext<"/api/testimonials/[id]">) {
  await connection();
  await ensureDatabaseSchema();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const principal = await getPrincipal(request.headers);
  if (!principal) return Response.json({ error: "Sign in to edit your review." }, { status: 401 });
  if (!(await enforceRateLimit(request, `testimonial-edit:${principal.actor.id}`, 10, 3600))) {
    return Response.json({ error: "Too many review changes. Try again later." }, { status: 429 });
  }

  const { id } = await context.params;
  if (!id || id.length > 200) return Response.json({ error: "Review was not found." }, { status: 404 });
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

  const result = await getDb().update(testimonials).set({
    quote: parsed.data.message,
    title: parsed.data.title,
    designation: parsed.data.designation,
    rating: parsed.data.rating,
    publicConsent: parsed.data.publicConsent,
    displayNameConsent: parsed.data.publicConsent && parsed.data.displayNameConsent,
    status: "pending",
    approvedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    updatedAt: new Date(),
  }).where(and(
    eq(testimonials.id, id),
    eq(testimonials.userId, principal.actor.id),
  ));
  if (result.rowsAffected === 0) return Response.json({ error: "Review was not found." }, { status: 404 });

  const review = await getDb().query.testimonials.findFirst({
    where: eq(testimonials.id, id),
  });
  if (!review || review.userId !== principal.actor.id) {
    return Response.json({ error: "Review was not found." }, { status: 404 });
  }

  await recordAudit({
    actorId: principal.actor.id,
    action: "testimonial.updated",
    resource: "testimonial",
    targetType: "testimonial",
    targetId: review.id,
  });
  return Response.json({ testimonial: review, status: review.status }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE(request: Request, context: RouteContext<"/api/testimonials/[id]">) {
  await connection();
  await ensureDatabaseSchema();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const principal = await getPrincipal(request.headers);
  if (!principal) return Response.json({ error: "Sign in to delete your review." }, { status: 401 });
  if (!(await enforceRateLimit(request, `testimonial-delete:${principal.actor.id}`, 5, 3600))) {
    return Response.json({ error: "Too many review changes. Try again later." }, { status: 429 });
  }

  const { id } = await context.params;
  if (!id || id.length > 200) return Response.json({ error: "Review was not found." }, { status: 404 });
  const result = await getDb().delete(testimonials)
    .where(and(
      eq(testimonials.id, id),
      eq(testimonials.userId, principal.actor.id),
    ));
  if (result.rowsAffected === 0) return Response.json({ error: "Review was not found." }, { status: 404 });
  await recordAudit({
    actorId: principal.actor.id,
    action: "testimonial.deleted",
    resource: "testimonial",
    targetType: "testimonial",
    targetId: id,
  });
  return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
