import { hash, compare } from "bcryptjs";
import { z } from "zod";

/** Cost factor — 12 is a solid production default (≈250ms on modern CPUs). */
export const BCRYPT_ROUNDS = 12;

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password is too long")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), {
    message: "Password must include at least one letter and one number",
  });

export async function hashPassword(password: string) {
  return hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}
