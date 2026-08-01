import Stripe from "stripe";
import { PLAN_LIMITS } from "@/lib/stripe-limits";

export { PLAN_LIMITS };

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripe) {
    // API version pinned by installed stripe package defaults
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_PRO &&
      process.env.NEXTAUTH_URL
  );
}

export function isProPlan(user: {
  plan: string;
  stripeStatus?: string | null;
}): boolean {
  if (user.plan === "pro" || user.plan === "team") return true;
  return user.stripeStatus === "active" || user.stripeStatus === "trialing";
}
