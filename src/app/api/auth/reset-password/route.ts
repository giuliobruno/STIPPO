import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumePasswordResetToken } from "@/lib/auth-recovery";
import { hashPassword, passwordSchema } from "@/lib/password";
import {
  clientKey,
  rateLimit,
  rateLimitHeaders,
  tooManyRequests,
} from "@/lib/rate-limit";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(clientKey(req, "reset-password"), {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) return tooManyRequests(limited);

  try {
    const body = schema.parse(await req.json());
    const email = await consumePasswordResetToken(body.token);
    if (!email) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Request a new one." },
        { status: 400, headers: rateLimitHeaders(limited) }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Request a new one." },
        { status: 400, headers: rateLimitHeaders(limited) }
      );
    }

    const passwordHash = await hashPassword(body.password);
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
