import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { auditLogs, billingCustomers, paymentMethods } from "@/db/schema";
import { getPrincipal } from "@/lib/authorization";
import { enforceRateLimit, isSameOriginRequest } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";

const confirmationSchema = z.object({
  sessionId: z.string().regex(/^cs_(?:test|live)_[A-Za-z0-9]+$/, "Invalid card setup session."),
});

function objectId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}

export async function POST(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const principal = await getPrincipal(request.headers);
  if (!principal) return Response.json({ error: "Sign in to confirm your payment method." }, { status: 401 });
  if (!(await enforceRateLimit(request, `billing-confirm:${principal.actor.id}`, 10, 900))) {
    return Response.json({ error: "Too many confirmation attempts. Try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Provide a valid payment confirmation." }, { status: 400 });
  }
  const parsed = confirmationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "The card setup session is invalid. Start card setup again." }, { status: 400 });
  }

  const db = getDb();
  const billingCustomer = await db.query.billingCustomers.findFirst({
    where: eq(billingCustomers.userId, principal.actor.id),
  });
  if (!billingCustomer) return Response.json({ error: "No billing profile exists for this account." }, { status: 404 });

  let verifiedCard: SavedCardDetails;
  try {
    const stripe = getStripe();
    const checkout = await stripe.checkout.sessions.retrieve(parsed.data.sessionId, {
      expand: ["setup_intent"],
    });
    if (
      checkout.mode !== "setup" ||
      checkout.status !== "complete" ||
      checkout.client_reference_id !== principal.actor.id ||
      checkout.metadata?.userId !== principal.actor.id ||
      objectId(checkout.customer) !== billingCustomer.stripeCustomerId
    ) {
      return Response.json({ error: "This card setup could not be verified for your account." }, { status: 400 });
    }

    const setupIntent = typeof checkout.setup_intent === "string"
      ? await stripe.setupIntents.retrieve(checkout.setup_intent, { expand: ["payment_method"] })
      : checkout.setup_intent;
    if (
      !setupIntent ||
      setupIntent.status !== "succeeded" ||
      setupIntent.metadata?.userId !== principal.actor.id ||
      objectId(setupIntent.customer) !== billingCustomer.stripeCustomerId
    ) {
      return Response.json({ error: "The payment provider has not verified this card setup." }, { status: 400 });
    }

    const paymentMethodId = objectId(setupIntent.payment_method);
    if (!paymentMethodId) {
      return Response.json({ error: "The verified card details were not returned by the payment provider." }, { status: 502 });
    }
    const paymentMethod = typeof setupIntent.payment_method === "object" && setupIntent.payment_method !== null
      ? setupIntent.payment_method
      : await stripe.paymentMethods.retrieve(paymentMethodId);
    if (!paymentMethod || paymentMethod.type !== "card" || objectId(paymentMethod.customer) !== billingCustomer.stripeCustomerId || !paymentMethod.card) {
      return Response.json({ error: "The payment provider returned an unsupported payment method." }, { status: 400 });
    }

    verifiedCard = {
      id: paymentMethod.id,
      brand: paymentMethod.card.brand,
      last4: paymentMethod.card.last4,
      expiryMonth: paymentMethod.card.exp_month,
      expiryYear: paymentMethod.card.exp_year,
    };
  } catch {
    return Response.json({ error: "The payment provider could not verify this setup. Please try again." }, { status: 502 });
  }

  try {
    await db.insert(paymentMethods).values({
      ...verifiedCard,
      userId: principal.actor.id,
    }).onConflictDoUpdate({
      target: paymentMethods.id,
      set: {
        brand: verifiedCard.brand,
        last4: verifiedCard.last4,
        expiryMonth: verifiedCard.expiryMonth,
        expiryYear: verifiedCard.expiryYear,
      },
    });
    await db.insert(auditLogs).values({
      id: randomUUID(),
      userId: principal.actor.id,
      action: "billing.card_setup.completed",
      resource: "billing.payment_method",
      metadata: JSON.stringify({ brand: verifiedCard.brand, last4: verifiedCard.last4 }),
    });
  } catch {
    return Response.json({ error: "Your card was verified, but its secure payment reference could not be saved. Return to Account and retry confirmation." }, { status: 503 });
  }
  return Response.json({ paymentMethod: verifiedCard }, { headers: { "Cache-Control": "private, no-store" } });
}

type SavedCardDetails = {
  id: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
};
