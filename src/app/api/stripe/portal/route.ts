import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export async function POST() {
  try {
    const sessionUser = await requireUser();
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }

    const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer yet. Subscribe first." },
        { status: 400 }
      );
    }

    const origin = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const portal = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/app/billing`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Portal failed" },
      { status: 500 }
    );
  }
}
