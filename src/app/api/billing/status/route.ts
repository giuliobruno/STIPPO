import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isProPlan, isStripeConfigured, PLAN_LIMITS } from "@/lib/stripe";

export async function GET() {
  try {
    const sessionUser = await requireUser();
    const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const pro = isProPlan(user);
    return NextResponse.json({
      plan: pro ? "pro" : "free",
      pro,
      stripeStatus: user.stripeStatus,
      memoryCount: user.memoryCount,
      memoryLimit: pro ? null : PLAN_LIMITS.free,
      stripeConfigured: isStripeConfigured(),
    });
  } catch (err) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status }
    );
  }
}
