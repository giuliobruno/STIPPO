import { prisma } from "@/lib/prisma";

/** Invalidate all existing JWTs + DB sessions for this user. */
export async function bumpSessionVersion(userId: string): Promise<number> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  await prisma.session.deleteMany({ where: { userId } }).catch(() => undefined);
  return updated.sessionVersion;
}
