import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { resolveAuthUrl } from "@/lib/auth-url";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const PREFIX = "password-reset:";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createRawToken() {
  return randomBytes(32).toString("hex");
}

/**
 * True when no outbound mailer is configured — show one-time link in the UI.
 * Disabled in production unless ALLOW_INLINE_RECOVERY=true (emergency / demos only).
 */
export function isInlineRecoveryEnabled() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_INLINE_RECOVERY !== "true"
  ) {
    return false;
  }
  return !process.env.SMTP_HOST && !process.env.RESEND_API_KEY;
}

export function hasMailerConfigured() {
  return Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY);
}

export async function createPasswordResetToken(email: string) {
  const normalized = email.toLowerCase().trim();
  const identifier = `${PREFIX}${normalized}`;
  const raw = createRawToken();
  const token = hashToken(raw);
  const expires = new Date(Date.now() + RESET_TTL_MS);

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  });

  return { email: normalized, rawToken: raw, expires };
}

export async function consumePasswordResetToken(rawToken: string) {
  const token = hashToken(rawToken);
  const row = await prisma.verificationToken.findUnique({ where: { token } });
  if (!row || !row.identifier.startsWith(PREFIX)) return null;
  if (row.expires.getTime() < Date.now()) {
    await prisma.verificationToken.delete({ where: { token } }).catch(() => undefined);
    return null;
  }

  const email = row.identifier.slice(PREFIX.length);
  await prisma.verificationToken.delete({ where: { token } });
  return email;
}

export function absoluteUrl(path: string) {
  const base = resolveAuthUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
