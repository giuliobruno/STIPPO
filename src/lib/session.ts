import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProPlan, PLAN_LIMITS } from "@/lib/stripe";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new AuthError("Unauthorized");
  }
  return session.user;
}

export async function getOptionalUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export class AuthError extends Error {
  status = 401;
  constructor(message = "Unauthorized") {
    super(message);
  }
}

export async function assertCanCreateMemory(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AuthError("User not found");

  if (isProPlan(user)) return user;

  const limit = PLAN_LIMITS.free;
  if (user.memoryCount >= limit) {
    const err = new Error(
      `Free plan limit reached (${limit} memories). Upgrade to Pro for unlimited.`
    ) as Error & { status: number };
    err.status = 402;
    throw err;
  }
  return user;
}
