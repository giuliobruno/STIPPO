import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import {
  analyzeImage,
  analyzeTranscript,
  mergeAnalyses,
} from "@/lib/ai/analyze";

export const runtime = "nodejs";

/**
 * Transient AI gateway — accepts image + optional transcript,
 * returns structured analysis. Bytes are NEVER persisted.
 */
export async function POST(req: NextRequest) {
  try {
    await requireUser();

    const form = await req.formData();
    const image = form.get("image") as File | null;
    const transcript = String(form.get("transcript") || "").trim();
    const hintsRaw = String(form.get("projectHints") || "[]");
    let projectHints: string[] = [];
    try {
      projectHints = JSON.parse(hintsRaw);
    } catch {
      projectHints = [];
    }

    if (!image && !transcript) {
      return NextResponse.json(
        { error: "Provide an image and/or transcript." },
        { status: 400 }
      );
    }

    // Size guard — vision detail:low works best under ~4MB
    if (image && image.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image too large for analysis (max 8MB)." },
        { status: 413 }
      );
    }

    let imageResult = null;
    if (image) {
      const buf = Buffer.from(await image.arrayBuffer());
      const mime = image.type || "image/jpeg";
      imageResult = await analyzeImage(buf.toString("base64"), mime, {
        voiceTranscript: transcript || undefined,
        projectHints,
      });
    }

    let audioResult = null;
    if (transcript) {
      audioResult = await analyzeTranscript(transcript, projectHints);
    }

    const analysis = await mergeAnalyses(imageResult, audioResult);

    return NextResponse.json({ analysis });
  } catch (err) {
    const status = (err as { status?: number })?.status || 500;
    const message = err instanceof Error ? err.message : "Analysis failed";
    if (status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[ai/analyze]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
