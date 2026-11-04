import { desc, isNotNull } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";
import { testimonials } from "@/db/schema";

function errorResponse(code: string, message: string, status = 503) {
  return Response.json({ code, error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  await connection();
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    return errorResponse("not_configured", "Testimonials are not configured yet. Please check back later.");
  }

  try {
    const records = await getDb().select({
      id: testimonials.id,
      name: testimonials.name,
      location: testimonials.location,
      quote: testimonials.quote,
      rating: testimonials.rating,
    }).from(testimonials)
      .where(isNotNull(testimonials.approvedAt))
      .orderBy(desc(testimonials.approvedAt))
      .limit(5);

    return Response.json(records.filter((record) =>
      Number.isInteger(record.rating) && record.rating >= 1 && record.rating <= 5 &&
      record.name.trim().length > 0 && record.quote.trim().length > 0,
    ), {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=240" },
    });
  } catch (error) {
    if (error instanceof Error && /no such table:\s*(?:(?:main|public)\.)?["`]?testimonials["`]?(?:\s|$)/i.test(error.message)) {
      return errorResponse("not_ready", "Testimonials are being set up. Please check back later.");
    }
    return errorResponse("temporarily_unavailable", "Approved testimonials could not be loaded. Please try again.");
  }
}
