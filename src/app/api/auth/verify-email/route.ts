import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeEmailVerificationToken } from "@/lib/auth-recovery";
import {
  clientKey,
  rateLimit,
  rateLimitHeaders,
  tooManyRequests,
} from "@/lib/rate-limit";

const schema = z.object({
  token: z.string().min(20).max(200),
});

export async function POST(req: NextRequest) {
  const limited = await rateLimit(clientKey(req, "verify-email"), {
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) return tooManyRequests(limited);

  try {
    const body = schema.parse(await req.json());
    const email = await consumeEmailVerificationToken(body.token);
    if (!email) {
      return NextResponse.json(
        { error: "This confirmation link is invalid or has expired." },
        { status: 400, headers: rateLimitHeaders(limited) }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: "This confirmation link is invalid or has expired." },
        { status: 400, headers: rateLimitHeaders(limited) }
      );
    }

    if (!user.emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
    }

    return NextResponse.json(
      { ok: true, email },
      { headers: rateLimitHeaders(limited) }
    );
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
