import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, accounts: { select: { provider: true } } },
    });

    if (!user) {
      return NextResponse.json({
        ok: true,
        found: false,
        message:
          "No account uses that email. Check the spelling, try another address, or create a new account.",
      });
    }

    const providers = user.accounts.map((a) => a.provider);
    const hasPassword = Boolean(user.passwordHash);
    const tips: string[] = [];
    if (hasPassword) tips.push("You can sign in with email and password.");
    if (providers.includes("google")) tips.push("You can also continue with Google.");
    if (!hasPassword && providers.length) {
      tips.push("This account has no password — use the social sign-in button on the login page.");
    }

    return NextResponse.json({
      ok: true,
      found: true,
      message: `Yes — ${email} is a registered login.`,
      tips,
    });
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
