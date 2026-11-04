import { asc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { paymentMethods } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/stripe";

export async function GET(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Sign in to view saved payment methods." }, { status: 401 });

  const methods = await getDb().select({
    id: paymentMethods.id,
    brand: paymentMethods.brand,
    last4: paymentMethods.last4,
    expiryMonth: paymentMethods.expiryMonth,
    expiryYear: paymentMethods.expiryYear,
  }).from(paymentMethods)
    .where(eq(paymentMethods.userId, session.user.id))
    .orderBy(asc(paymentMethods.createdAt));

  return Response.json({ configured: isStripeConfigured(), paymentMethods: methods }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
