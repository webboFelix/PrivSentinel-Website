import Stripe from "stripe";
import { getServerEnv } from "@/lib/env";

let stripeClient: Stripe | undefined;

export function isStripeConfigured() {
  return Boolean(getServerEnv().STRIPE_SECRET_KEY);
}

export function getStripe() {
  const secretKey = getServerEnv().STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe is not configured.");
  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}
