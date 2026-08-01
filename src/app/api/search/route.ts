import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { searchMemories } from "@/lib/search";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const q = req.nextUrl.searchParams.get("q") || "";
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const hits = await searchMemories({
      userId: user.id,
      query: q,
      projectId,
    });
    return NextResponse.json({ hits, query: q });
  } catch (err) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status }
    );
  }
}
