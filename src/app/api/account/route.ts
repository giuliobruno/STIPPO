import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, AuthError } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export async function GET() {
  try {
    const sessionUser = await requireUser();
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        memoryCount: true,
        stripeStatus: true,
        createdAt: true,
        passwordHash: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      memoryCount: user.memoryCount,
      stripeStatus: user.stripeStatus,
      createdAt: user.createdAt.toISOString(),
      hasPassword: Boolean(user.passwordHash),
    });
  } catch (err) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status }
    );
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await requireUser();
    const body = patchSchema.parse(await req.json());

    const updated = await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        name: body.name,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message }, { status: 400 });
    }
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status }
    );
  }
}

const deleteSchema = z.object({
  confirmation: z.literal("DELETE"),
  email: z.string().email(),
  password: z.string().min(1).optional(),
});

export async function DELETE(req: NextRequest) {
  try {
    const sessionUser = await requireUser();
    const body = deleteSchema.parse(await req.json());

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (body.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Email confirmation does not match this account." },
        { status: 400 }
      );
    }

    if (user.passwordHash) {
      if (!body.password) {
        return NextResponse.json(
          { error: "Password is required to delete this account." },
          { status: 400 }
        );
      }
      const ok = await compare(body.password, user.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: "Incorrect password." }, { status: 403 });
      }
    }

    // Cancel Stripe subscription if present
    if (isStripeConfigured() && user.stripeSubscriptionId) {
      try {
        const stripe = getStripe();
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      } catch (e) {
        console.error("Stripe cancel on account delete failed", e);
      }
    }

    const memories = await prisma.memory.findMany({
      where: { userId: user.id },
      select: { originalKey: true, thumbnailKey: true, audioKey: true },
    });

    const storage = getStorage();
    for (const m of memories) {
      if (m.originalKey && !m.originalKey.startsWith("voice:")) {
        await storage.delete(m.originalKey);
      }
      if (m.thumbnailKey) await storage.delete(m.thumbnailKey);
      if (m.audioKey) await storage.delete(m.audioKey);
    }

    // Cascades: accounts, sessions, projects, memories
    await prisma.user.delete({ where: { id: user.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message }, { status: 400 });
    }
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
