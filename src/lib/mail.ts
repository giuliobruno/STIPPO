/**
 * Outbound email — Resend (preferred) or SMTP (nodemailer).
 * Deliverability: verify your domain in Resend (SPF/DKIM/DMARC) and use EMAIL_FROM on that domain.
 */

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  /** Optional List-Unsubscribe URL (helps inbox placement). */
  listUnsubscribeUrl?: string;
  tags?: Array<{ name: string; value: string }>;
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

function defaultFrom() {
  return (
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    "Stippo <onboarding@resend.dev>"
  );
}

async function sendViaResend(input: SendMailInput) {
  const from = defaultFrom();
  const headers: Record<string, string> = {
    "X-Entity-Ref-ID": `${Date.now()}`,
  };
  if (input.listUnsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${input.listUnsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

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
      reply_to: input.replyTo || process.env.EMAIL_REPLY_TO || undefined,
      headers,
      tags: input.tags,
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

  const headers: Record<string, string> = {};
  if (input.listUnsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${input.listUnsubscribeUrl}>`;
  }

  await transporter.sendMail({
    from: defaultFrom(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo || process.env.EMAIL_REPLY_TO,
    headers,
  });
}

function brandFooter() {
  return [
    "—",
    "Stippo — work visual vault for architects",
    "https://www.stippo.app",
  ].join("\n");
}

function emailShell(title: string, bodyHtml: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f1ec;color:#141414;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f1ec;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e0d8;border-radius:16px;padding:28px 24px;">
          <tr>
            <td style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#6b6560;font-family:system-ui,sans-serif;">
              Stippo
            </td>
          </tr>
          <tr>
            <td style="padding-top:16px;font-size:28px;line-height:1.2;color:#141414;">
              ${escapeHtml(title)}
            </td>
          </tr>
          <tr>
            <td style="padding-top:16px;font-size:15px;line-height:1.55;color:#3d3a36;font-family:system-ui,sans-serif;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding-top:28px;font-size:12px;line-height:1.5;color:#8a847c;font-family:system-ui,sans-serif;">
              You received this email because of an action on your Stippo account.<br />
              Stippo · <a href="https://www.stippo.app" style="color:#1e3a5f;">www.stippo.app</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function passwordResetEmail(resetUrl: string) {
  const subject = "Reset your Stippo password";
  const text = [
    "Reset your Stippo password",
    "",
    "You requested a password reset for your Stippo account.",
    "Open this link within 1 hour:",
    resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
    "",
    brandFooter(),
  ].join("\n");

  const html = emailShell(
    "Reset your password",
    `
      <p>You requested a password reset for your Stippo account.</p>
      <p style="margin:24px 0;">
        <a href="${escapeHtml(resetUrl)}"
           style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-family:system-ui,sans-serif;font-size:14px;">
          Reset password
        </a>
      </p>
      <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
      <p style="word-break:break-all;font-size:12px;color:#8a847c;">${escapeHtml(resetUrl)}</p>
    `
  );

  return {
    subject,
    text,
    html,
    listUnsubscribeUrl: "https://www.stippo.app/privacy",
    tags: [{ name: "category", value: "password_reset" }],
  };
}

export function emailVerificationEmail(verifyUrl: string, name?: string | null) {
  const greeting = name?.trim() ? `Hi ${name.trim()},` : "Hi,";
  const subject = "Confirm your Stippo email";
  const text = [
    "Confirm your Stippo email",
    "",
    greeting,
    "",
    "Thanks for creating a Stippo account. Confirm your email to start using your work vault:",
    verifyUrl,
    "",
    "This link expires in 24 hours.",
    "If you did not create this account, you can ignore this email.",
    "",
    brandFooter(),
  ].join("\n");

  const html = emailShell(
    "Confirm your email",
    `
      <p>${escapeHtml(greeting)}</p>
      <p>Thanks for creating a Stippo account. Confirm your email to start using your work vault.</p>
      <p style="margin:24px 0;">
        <a href="${escapeHtml(verifyUrl)}"
           style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-family:system-ui,sans-serif;font-size:14px;">
          Confirm email
        </a>
      </p>
      <p>This link expires in 24 hours. If you did not create this account, ignore this email.</p>
      <p style="word-break:break-all;font-size:12px;color:#8a847c;">${escapeHtml(verifyUrl)}</p>
    `
  );

  return {
    subject,
    text,
    html,
    listUnsubscribeUrl: "https://www.stippo.app/privacy",
    tags: [{ name: "category", value: "email_verification" }],
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
