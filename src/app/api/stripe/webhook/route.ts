import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  const rawBody = await req.text();

  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else if (process.env.NODE_ENV === "development") {
      event = JSON.parse(rawBody) as Stripe.Event;
    } else {
      return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
    }
  } catch (err) {
    console.error("Webhook signature error", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (userId && session.subscription) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              plan: "pro",
              stripeSubscriptionId: String(session.subscription),
              stripeStatus: "active",
              stripeCustomerId: session.customer
                ? String(session.customer)
                : undefined,
            },
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        const customerId = String(sub.customer);
        const user = userId
          ? await prisma.user.findUnique({ where: { id: userId } })
          : await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });

        if (user) {
          const active =
            sub.status === "active" || sub.status === "trialing";
          await prisma.user.update({
            where: { id: user.id },
            data: {
              plan: active ? "pro" : "free",
              stripeStatus: sub.status,
              stripeSubscriptionId: sub.id,
            },
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Webhook handler error", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
