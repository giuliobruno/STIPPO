import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { hasMailerConfigured } from "@/lib/auth-recovery";

/**
 * Mail config probe — authenticated in all environments.
 * Does not send email or expose full secrets.
 */
export async function GET() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_MAIL_HEALTH !== "true"
  ) {
    return NextResponse.json(
      { error: "Mail health probe disabled in production." },
      { status: 404 }
    );
  }

  const key = process.env.RESEND_API_KEY?.trim().replace(/^["']|["']$/g, "") || "";
  const from = process.env.EMAIL_FROM?.trim() || "";

  return NextResponse.json({
    mailerConfigured: hasMailerConfigured(),
    resendKeyPresent: Boolean(key),
    resendKeyLooksValid: key.startsWith("re_"),
    emailFromPresent: Boolean(from),
    // Never return the full EMAIL_FROM in production probes
    emailFrom:
      process.env.NODE_ENV === "production"
        ? from
          ? "[configured]"
          : null
        : from || null,
    usingResendDevFrom: /@resend\.dev>?$/i.test(from),
  });
}
