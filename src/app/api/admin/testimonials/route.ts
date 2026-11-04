import { desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { testimonials, user } from "@/db/schema";
import { isResponse, requireAdminApi } from "@/lib/admin-api";

const statuses = new Set(["pending", "approved", "rejected"]);

export async function GET(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  const principal = await requireAdminApi(request);
  if (isResponse(principal)) return principal;

  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  if (!statuses.has(status)) {
    return Response.json({ error: "Select a valid moderation status." }, { status: 400 });
  }
  const rows = await getDb().select({
    id: testimonials.id,
    userId: testimonials.userId,
    name: testimonials.name,
    email: user.email,
    designation: testimonials.designation,
    publicConsent: testimonials.publicConsent,
    displayNameConsent: testimonials.displayNameConsent,
    title: testimonials.title,
    message: testimonials.quote,
    rating: testimonials.rating,
    status: testimonials.status,
    createdAt: testimonials.createdAt,
    reviewedAt: testimonials.reviewedAt,
  }).from(testimonials)
    .leftJoin(user, eq(testimonials.userId, user.id))
    .where(eq(testimonials.status, status))
    .orderBy(desc(testimonials.createdAt))
    .limit(100);

  return Response.json({ testimonials: rows }, { headers: { "Cache-Control": "no-store" } });
}
