import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { testimonials } from "@/db/schema";
import { getPrincipal } from "@/lib/authorization";

export async function GET(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  const principal = await getPrincipal(request.headers);
  if (!principal) return Response.json({ error: "Sign in to manage your review." }, { status: 401 });

  const testimonial = await getDb().query.testimonials.findFirst({
    where: eq(testimonials.userId, principal.actor.id),
  });
  return Response.json({ testimonial: testimonial ?? null }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
