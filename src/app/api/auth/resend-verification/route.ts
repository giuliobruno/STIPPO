import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  absoluteUrl,
  createEmailVerificationToken,
  hasMailerConfigured,
  isInlineRecoveryEnabled,
} from "@/lib/auth-recovery";
import { emailVerificationEmail, sendMail } from "@/lib/mail";
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
  "If an unverified account exists for that email, we sent a new confirmation link.";

export async function POST(req: NextRequest) {
  const limited = rateLimit(clientKey(req, "resend-verification"), {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) return tooManyRequests(limited);

  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, passwordHash: true, emailVerified: true },
    });

    if (!user?.passwordHash || user.emailVerified) {
      return NextResponse.json(
        { ok: true, message: GENERIC, inline: false },
        { headers: rateLimitHeaders(limited) }
      );
    }

    const { rawToken } = await createEmailVerificationToken(email);
    const verifyUrl = absoluteUrl(`/verify-email?token=${rawToken}`);
    const mail = emailVerificationEmail(verifyUrl, user.name);

    if (isInlineRecoveryEnabled()) {
      console.info(`[auth] Email verification link for ${email}: ${verifyUrl}`);
      return NextResponse.json(
        {
          ok: true,
          message: "Email delivery is not configured. Use the link below.",
          inline: true,
          verifyUrl,
        },
        { headers: rateLimitHeaders(limited) }
      );
    }

    if (!hasMailerConfigured()) {
      console.error("[auth] Resend verification requested but no mailer configured");
      return NextResponse.json(
        { ok: true, message: GENERIC, inline: false },
        { headers: rateLimitHeaders(limited) }
      );
    }

    try {
      await sendMail({ to: email, ...mail });
    } catch (err) {
      console.error("[auth] Failed to resend verification email", err);
    }

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
