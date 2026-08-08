import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordSchema } from "@/lib/password";
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
  name: z.string().min(1).max(80),
  email: z.string().email().max(254),
  password: passwordSchema,
});

const GENERIC_CONFLICT =
  "Unable to create this account. Try signing in, or use a different email.";

export async function POST(req: Request) {
  const limited = rateLimit(clientKey(req, "register"), {
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) return tooManyRequests(limited);

  try {
    const body = await req.json();
    const data = schema.parse(body);
    const email = data.email.toLowerCase().trim();

    if (!hasMailerConfigured() && !isInlineRecoveryEnabled()) {
      return NextResponse.json(
        {
          error:
            "Email delivery is not configured. Set RESEND_API_KEY (and EMAIL_FROM) before creating accounts.",
        },
        { status: 503, headers: rateLimitHeaders(limited) }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      return NextResponse.json(
        { error: GENERIC_CONFLICT },
        { status: 409, headers: rateLimitHeaders(limited) }
      );
    }

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email,
        passwordHash,
        emailVerified: null,
      },
      select: { id: true, email: true, name: true },
    });

    await prisma.project.create({
      data: {
        userId: user.id,
        name: "Sample — Milan Hotel",
        description: "Demo project for facade and material references",
        location: "Milan, Italy",
        clientName: "Demo Client",
      },
    });

    const { rawToken } = await createEmailVerificationToken(email);
    const verifyUrl = absoluteUrl(`/verify-email?token=${rawToken}`);
    const mail = emailVerificationEmail(verifyUrl, user.name);

    if (isInlineRecoveryEnabled()) {
      console.info(`[auth] Email verification link for ${email}: ${verifyUrl}`);
      return NextResponse.json(
        {
          ok: true,
          requiresVerification: true,
          message:
            "Account created. Email delivery is not configured — use the verification link below.",
          inline: true,
          verifyUrl,
          email,
        },
        { status: 201, headers: rateLimitHeaders(limited) }
      );
    }

    try {
      await sendMail({ to: email, ...mail });
    } catch (err) {
      console.error("[auth] Failed to send verification email", err);
      return NextResponse.json(
        {
          ok: true,
          requiresVerification: true,
          message:
            "Account created, but we could not send the confirmation email. Use Resend verification from the check-email page.",
          email,
          sendFailed: true,
        },
        { status: 201, headers: rateLimitHeaders(limited) }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        requiresVerification: true,
        message: "Check your inbox to confirm your email before signing in.",
        email,
      },
      { status: 201, headers: rateLimitHeaders(limited) }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
