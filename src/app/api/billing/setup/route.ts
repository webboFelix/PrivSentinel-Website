import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { auditLogs, billingCustomers } from "@/db/schema";
import { getPrincipal } from "@/lib/authorization";
import { getServerEnv } from "@/lib/env";
import { enforceRateLimit, isSameOriginRequest } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const principal = await getPrincipal(request.headers);
  if (!principal) return Response.json({ error: "Sign in before adding a payment card." }, { status: 401 });
  if (!(await enforceRateLimit(request, `billing-setup:${principal.actor.id}`, 5, 900))) {
    return Response.json({ error: "Too many card setup attempts. Try again later." }, { status: 429 });
  }

  const env = getServerEnv();
  if (!env.STRIPE_SECRET_KEY) {
    return Response.json({ error: "Card setup is unavailable until Stripe is configured." }, { status: 503 });
  }
  const appUrl = env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return Response.json({ error: "Billing is not configured for this application URL." }, { status: 503 });
  const requestUrl = new URL(request.url);
  const returnUrl = process.env.NODE_ENV === "development" &&
    ["localhost", "127.0.0.1"].includes(requestUrl.hostname)
    ? requestUrl.origin
    : appUrl;

  const db = getDb();
  const existing = await db.query.billingCustomers.findFirst({
    where: eq(billingCustomers.userId, principal.actor.id),
  });
  let stripeCustomerId = existing?.stripeCustomerId;
  if (!stripeCustomerId) {
    let customerId: string;
    try {
      const customer = await getStripe().customers.create({
        email: principal.actor.email,
        name: principal.actor.name,
        metadata: { userId: principal.actor.id },
      });
      customerId = customer.id;
    } catch {
      return Response.json({ error: "The payment provider could not create a billing profile. Please try again." }, { status: 502 });
    }

    try {
      await db.insert(billingCustomers).values({
        id: randomUUID(),
        userId: principal.actor.id,
        stripeCustomerId: customerId,
      }).onConflictDoNothing({ target: billingCustomers.userId });
      const persisted = await db.query.billingCustomers.findFirst({
        where: eq(billingCustomers.userId, principal.actor.id),
      });
      if (!persisted) {
        return Response.json({ error: "A billing profile could not be created. Please try again." }, { status: 503 });
      }
      stripeCustomerId = persisted.stripeCustomerId;
    } catch {
      return Response.json({ error: "The billing profile could not be saved. Please try again." }, { status: 503 });
    }
  }

  let checkoutUrl: string;
  try {
    const checkout = await getStripe().checkout.sessions.create({
      mode: "setup",
      customer: stripeCustomerId,
      allowed_payment_method_types: ["card"],
      client_reference_id: principal.actor.id,
      metadata: { userId: principal.actor.id },
      setup_intent_data: { metadata: { userId: principal.actor.id } },
      success_url: new URL("/account?payment=success&session_id={CHECKOUT_SESSION_ID}", returnUrl).toString(),
      cancel_url: new URL("/account?payment=cancelled", returnUrl).toString(),
    });
    if (!checkout.url) {
      return Response.json({ error: "The secure card setup page could not be opened." }, { status: 502 });
    }
    checkoutUrl = checkout.url;
  } catch {
    return Response.json({ error: "The payment provider could not start card verification. Please try again." }, { status: 502 });
  }

  try {
    await db.insert(auditLogs).values({
      id: randomUUID(),
      userId: principal.actor.id,
      action: "billing.card_setup.started",
      resource: "billing",
    });
  } catch {
    return Response.json({ error: "The card setup audit event could not be recorded. Please retry setup." }, { status: 503 });
  }
  return Response.json({ url: checkoutUrl }, { headers: { "Cache-Control": "no-store" } });
}
