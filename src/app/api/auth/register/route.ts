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
  type RateLimitResult,
} from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().max(254),
  password: passwordSchema,
});

/** Same shape for new + existing emails — prevents account enumeration. */
function genericRegisterOk(
  email: string,
  limited: RateLimitResult,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      ok: true,
      requiresVerification: true,
      message: "Check your inbox to confirm your email before signing in.",
      email,
      ...extra,
    },
    { status: 201, headers: rateLimitHeaders(limited) }
  );
}

export async function POST(req: Request) {
  const limited = await rateLimit(clientKey(req, "register"), {
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
      // Anti-enumeration: identical success response; do not reveal the conflict.
      // Optionally re-send verification if still unverified.
      if (!existing.emailVerified && hasMailerConfigured()) {
        try {
          const { rawToken } = await createEmailVerificationToken(email);
          const verifyUrl = absoluteUrl(`/verify-email?token=${rawToken}`);
          const mail = emailVerificationEmail(verifyUrl, existing.name);
          await sendMail({ to: email, ...mail });
        } catch {
          /* ignore */
        }
      }
      if (isInlineRecoveryEnabled()) {
        return genericRegisterOk(email, limited, {
          message:
            "If this email can be registered, check your inbox (or the inline link in local/dev).",
          inline: true,
        });
      }
      return genericRegisterOk(email, limited);
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
      const sent = await sendMail({ to: email, ...mail });
      return NextResponse.json(
        {
          ok: true,
          requiresVerification: true,
          message: "Check your inbox to confirm your email before signing in.",
          email,
          resendId: sent.id || null,
        },
        { status: 201, headers: rateLimitHeaders(limited) }
      );
    } catch (err) {
      console.error("[auth] Failed to send verification email", err);
      return NextResponse.json(
        {
          ok: true,
          requiresVerification: true,
          message:
            "Account created, but the confirmation email failed to send. Check RESEND_API_KEY / EMAIL_FROM on the server, then use Resend below.",
          email,
          sendFailed: true,
          mailError:
            process.env.NODE_ENV !== "production" && err instanceof Error
              ? err.message
              : undefined,
        },
        { status: 201, headers: rateLimitHeaders(limited) }
      );
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
