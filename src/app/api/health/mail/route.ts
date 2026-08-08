import { NextResponse } from "next/server";
import { hasMailerConfigured } from "@/lib/auth-recovery";

/**
 * Safe mail config probe — does not send email or expose secrets.
 */
export async function GET() {
  const key = process.env.RESEND_API_KEY?.trim().replace(/^["']|["']$/g, "") || "";
  const from = process.env.EMAIL_FROM?.trim() || "";

  return NextResponse.json({
    mailerConfigured: hasMailerConfigured(),
    resendKeyPresent: Boolean(key),
    resendKeyLooksValid: key.startsWith("re_"),
    emailFromPresent: Boolean(from),
    emailFrom: from || null,
    usingResendDevFrom: /@resend\.dev>?$/i.test(from),
  });
}