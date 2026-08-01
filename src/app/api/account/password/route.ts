import { NextRequest, NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireUser();
    const body = schema.parse(await req.json());

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });
    if (!user?.passwordHash) {
      return NextResponse.json(
        {
          error:
            "This account signs in with a social provider. Password change is not available.",
        },
        { status: 400 }
      );
    }

    const ok = await compare(body.currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
    }

    const passwordHash = await hash(body.newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message }, { status: 400 });
    }
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status }
    );
  }
}
