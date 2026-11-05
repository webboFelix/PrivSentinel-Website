import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb, getLibsqlClient } from "@/db";
import { testimonials } from "@/db/schema";
import { isResponse, requireAdminApi } from "@/lib/admin-api";
import { enforceRateLimit, isSameOriginRequest } from "@/lib/rate-limit";

const moderationSchema = z.object({
  status: z.enum(["approved", "rejected"]),
}).strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  await ensureDatabaseSchema();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const principal = await requireAdminApi(request);
  if (isResponse(principal)) return principal;
  if (!(await enforceRateLimit(request, `testimonial-moderation:${principal.actor.id}`, 120, 3600))) {
    return Response.json({ error: "Too many moderation actions. Try again later." }, { status: 429 });
  }
  const { id } = await context.params;
  if (!id || id.length > 200) return Response.json({ error: "Review was not found." }, { status: 404 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Provide a valid moderation action." }, { status: 400 });
  }
  const parsed = moderationSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "Select approve or reject." }, { status: 400 });

  const now = Date.now();
  const action = parsed.data.status === "approved" ? "admin.testimonial.approved" : "admin.testimonial.rejected";
  const transaction = await getLibsqlClient().transaction("write");
  try {
    const updated = await transaction.execute({
      sql: `UPDATE "testimonials"
        SET "status" = ?, "approvedAt" = ?, "reviewedBy" = ?, "reviewedAt" = ?, "updatedAt" = ?
        WHERE "id" = ?`,
      args: [
        parsed.data.status,
        parsed.data.status === "approved" ? now : null,
        principal.actor.id,
        now,
        now,
        id,
      ],
    });
    if (updated.rowsAffected === 0) {
      await transaction.rollback();
      return Response.json({ error: "Review was not found." }, { status: 404 });
    }
    await transaction.execute({
      sql: `INSERT INTO "audit_logs" ("id", "userId", "action", "resource", "timestamp", "targetType", "targetId")
        VALUES (?, ?, ?, 'testimonial', ?, 'testimonial', ?)`,
      args: [randomUUID(), principal.actor.id, action, now, id],
    });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  const review = await getDb().query.testimonials.findFirst({
    where: and(eq(testimonials.id, id), eq(testimonials.status, parsed.data.status)),
  });
  return Response.json({ success: true, testimonial: review }, {
    headers: { "Cache-Control": "no-store" },
  });
}
