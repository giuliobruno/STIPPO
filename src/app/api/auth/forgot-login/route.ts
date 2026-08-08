import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  clientKey,
  rateLimit,
  rateLimitHeaders,
  tooManyRequests,
} from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
});

/**
 * Intentionally does not reveal whether an email is registered.
 * Offers the same recovery guidance every time.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(clientKey(req, "forgot-login"), {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) return tooManyRequests(limited);

  try {
    schema.parse(await req.json());

    return NextResponse.json(
      {
        ok: true,
        message:
          "If that email is registered, you can sign in with your password or Google (if you linked it). Use Forgot password to reset a password login.",
        tips: [
          "Try signing in with the email and password you used at registration.",
          "If you used Google, tap Continue with Google on the login page.",
          "Forgot password sends a reset link when email delivery is configured.",
        ],
      },
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
