import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStorage } from "@/lib/storage";

type Ctx = { params: { key: string[] } };

/**
 * Auth-gated media serve for local-first storage.
 * In S3/Supabase mode, clients typically use signed URLs instead.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = params.key.join("/");
  // Ensure user can only read their own keys; block path traversal
  if (
    !key.startsWith(`${session.user.id}/`) &&
    key !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (key.includes("..") || key.includes("\\") || key.startsWith("/")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const storage = getStorage();
    const data = await storage.read(key);
    const ext = key.split(".").pop()?.toLowerCase();
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : ext === "pdf"
              ? "application/pdf"
              : ext === "webm"
                ? "audio/webm"
                : "image/jpeg";

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
