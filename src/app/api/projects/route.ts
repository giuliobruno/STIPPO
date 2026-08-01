import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { z } from "zod";

export async function GET() {
  try {
    const user = await requireUser();
    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      include: { _count: { select: { memories: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        location: p.location,
        clientName: p.clientName,
        status: p.status,
        memoryCount: p._count.memories,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status }
    );
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  location: z.string().max(120).optional(),
  clientName: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const data = createSchema.parse(await req.json());
    const project = await prisma.project.create({
      data: { userId: user.id, ...data },
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status }
    );
  }
}
