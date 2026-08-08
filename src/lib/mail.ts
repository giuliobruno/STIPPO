/**
 * Outbound email — Resend (preferred) or SMTP (nodemailer).
 * Secrets stay server-side only.
 */

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendMail(input: SendMailInput): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    await sendViaResend(input);
    return;
  }
  if (process.env.SMTP_HOST) {
    await sendViaSmtp(input);
    return;
  }
  throw new Error("No mailer configured (set RESEND_API_KEY or SMTP_HOST)");
}

async function sendViaResend(input: SendMailInput) {
  const from =
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    "Stippo <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html || undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

async function sendViaSmtp(input: SendMailInput) {
  const nodemailer = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

export function passwordResetEmail(resetUrl: string) {
  const subject = "Reset your Stippo password";
  const text = [
    "You requested a password reset for your Stippo account.",
    "",
    "Open this link within 1 hour:",
    resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
    "",
    "— Stippo",
  ].join("\n");

  const html = `
    <p>You requested a password reset for your Stippo account.</p>
    <p><a href="${escapeHtml(resetUrl)}">Reset your password</a> (valid for 1 hour).</p>
    <p>If you did not request this, you can ignore this email.</p>
    <p>— Stippo</p>
  `.trim();

  return { subject, text, html };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
