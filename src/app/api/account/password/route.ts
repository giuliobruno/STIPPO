import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  hashPassword,
  passwordSchema,
  verifyPassword,
} from "@/lib/password";
import {
  clientKey,
  rateLimit,
  rateLimitHeaders,
  tooManyRequests,
} from "@/lib/rate-limit";

const schema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(clientKey(req, "account-password"), {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) return tooManyRequests(limited);

  try {
    const sessionUser = await requireUser();
    const body = schema.parse(await req.json());

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });
    if (!user?.passwordHash) {
      return NextResponse.json(
        {
          error:
            "This account signs in with a social provider. Password change is not available.",
        },
        { status: 400 }
      );
    }

    const ok = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 403, headers: rateLimitHeaders(limited) }
      );
    }

    const passwordHash = await hashPassword(body.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return NextResponse.json(
      { ok: true },
      { headers: rateLimitHeaders(limited) }
    );
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
