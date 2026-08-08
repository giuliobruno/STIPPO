import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { resolveAuthUrl } from "@/lib/auth-url";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PREFIX = "password-reset:";
const VERIFY_PREFIX = "email-verify:";

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
  const resend = process.env.RESEND_API_KEY?.trim().replace(/^["']|["']$/g, "");
  const smtp = process.env.SMTP_HOST?.trim();
  return Boolean(resend || smtp);
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

export async function createEmailVerificationToken(email: string) {
  const normalized = email.toLowerCase().trim();
  const identifier = `${VERIFY_PREFIX}${normalized}`;
  const raw = createRawToken();
  const token = hashToken(raw);
  const expires = new Date(Date.now() + VERIFY_TTL_MS);

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  });

  return { email: normalized, rawToken: raw, expires };
}

export async function consumeEmailVerificationToken(rawToken: string) {
  const token = hashToken(rawToken);
  const row = await prisma.verificationToken.findUnique({ where: { token } });
  if (!row || !row.identifier.startsWith(VERIFY_PREFIX)) return null;
  if (row.expires.getTime() < Date.now()) {
    await prisma.verificationToken.delete({ where: { token } }).catch(() => undefined);
    return null;
  }

  const email = row.identifier.slice(VERIFY_PREFIX.length);
  await prisma.verificationToken.delete({ where: { token } });
  return email;
}
