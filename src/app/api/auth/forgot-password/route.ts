import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  absoluteUrl,
  createPasswordResetToken,
  hasMailerConfigured,
  isInlineRecoveryEnabled,
} from "@/lib/auth-recovery";
import {
  clientKey,
  rateLimit,
  rateLimitHeaders,
  tooManyRequests,
} from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
});

const GENERIC =
  "If an account exists for that email, you will receive reset instructions shortly.";

export async function POST(req: NextRequest) {
  const limited = rateLimit(clientKey(req, "forgot-password"), {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) return tooManyRequests(limited);

  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });

    // Always look like success to avoid account enumeration.
    if (!user?.passwordHash) {
      return NextResponse.json(
        { ok: true, message: GENERIC, inline: false },
        { headers: rateLimitHeaders(limited) }
      );
    }

    const { rawToken } = await createPasswordResetToken(email);
    const resetUrl = absoluteUrl(`/reset-password?token=${rawToken}`);

    if (isInlineRecoveryEnabled()) {
      console.info(`[auth] Password reset link for ${email}: ${resetUrl}`);
      return NextResponse.json(
        {
          ok: true,
          message:
            "Email delivery is not configured on this server. Use the one-time link below to set a new password.",
          inline: true,
          resetUrl,
        },
        { headers: rateLimitHeaders(limited) }
      );
    }

    if (!hasMailerConfigured()) {
      // Production without mailer: do not leak the reset URL.
      console.error(
        `[auth] Password reset requested for ${email} but no mailer is configured (set RESEND_API_KEY or SMTP_HOST).`
      );
      return NextResponse.json(
        { ok: true, message: GENERIC, inline: false },
        { headers: rateLimitHeaders(limited) }
      );
    }

    // TODO: send via Resend/SMTP when mailer module is wired.
    console.info(
      `[auth] Password reset requested for ${email} (mailer configured — wire send path)`
    );
    return NextResponse.json(
      { ok: true, message: GENERIC, inline: false },
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
