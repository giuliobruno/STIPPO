import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  absoluteUrl,
  createPasswordResetToken,
  isInlineRecoveryEnabled,
} from "@/lib/auth-recovery";

const schema = z.object({
  email: z.string().email(),
});

const GENERIC =
  "If an account exists for that email, you can reset the password with the steps below.";

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });

    // Always look like success to avoid account enumeration when mailer is on.
    if (!user?.passwordHash) {
      return NextResponse.json({
        ok: true,
        message: GENERIC,
        inline: false,
      });
    }

    const { rawToken } = await createPasswordResetToken(email);
    const resetUrl = absoluteUrl(`/reset-password?token=${rawToken}`);

    if (isInlineRecoveryEnabled()) {
      // Self-hosted / local: no SMTP — surface the one-time link in the UI.
      console.info(`[auth] Password reset link for ${email}: ${resetUrl}`);
      return NextResponse.json({
        ok: true,
        message:
          "Email delivery is not configured on this server. Use the one-time link below to set a new password.",
        inline: true,
        resetUrl,
      });
    }

    // Placeholder for future SMTP / Resend integration.
    console.info(`[auth] Password reset requested for ${email} (mailer configured but not sent yet)`);
    return NextResponse.json({
      ok: true,
      message: "If an account exists for that email, reset instructions have been sent.",
      inline: false,
    });
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
