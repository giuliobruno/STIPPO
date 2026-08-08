import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordSchema } from "@/lib/password";
import {
  clientKey,
  rateLimit,
  rateLimitHeaders,
  tooManyRequests,
} from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().max(254),
  password: passwordSchema,
});

const GENERIC_CONFLICT =
  "Unable to create this account. Try signing in, or use a different email.";

export async function POST(req: Request) {
  const limited = rateLimit(clientKey(req, "register"), {
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) return tooManyRequests(limited);

  try {
    const body = await req.json();
    const data = schema.parse(body);
    const email = data.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      // Avoid confirming which emails are registered.
      return NextResponse.json(
        { error: GENERIC_CONFLICT },
        { status: 409, headers: rateLimitHeaders(limited) }
      );
    }

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email,
        passwordHash,
      },
      select: { id: true, email: true, name: true },
    });

    await prisma.project.create({
      data: {
        userId: user.id,
        name: "Sample — Milan Hotel",
        description: "Demo project for facade and material references",
        location: "Milan, Italy",
        clientName: "Demo Client",
      },
    });

    return NextResponse.json(
      { user },
      { status: 201, headers: rateLimitHeaders(limited) }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
