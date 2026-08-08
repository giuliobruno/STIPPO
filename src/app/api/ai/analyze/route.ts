import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import {
  analyzeImage,
  analyzeTranscript,
  mergeAnalyses,
} from "@/lib/ai/analyze";
import {
  clientKey,
  rateLimit,
  rateLimitHeaders,
  tooManyRequests,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/**
 * Transient AI gateway — accepts image + optional transcript,
 * returns structured analysis. Bytes are NEVER persisted.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const limited = rateLimit(`ai-analyze:${user.id}`, {
      limit: 60,
      windowMs: 60 * 60 * 1000,
    });
    // Also dampen by IP for stolen sessions / shared NATs lightly
    const ipLimited = rateLimit(clientKey(req, "ai-analyze-ip"), {
      limit: 120,
      windowMs: 60 * 60 * 1000,
    });
    if (!limited.ok) return tooManyRequests(limited);
    if (!ipLimited.ok) return tooManyRequests(ipLimited);

    const form = await req.formData();
    const image = form.get("image") as File | null;
    const transcript = String(form.get("transcript") || "").trim().slice(0, 8000);
    const hintsRaw = String(form.get("projectHints") || "[]");
    let projectHints: string[] = [];
    try {
      const parsed = JSON.parse(hintsRaw);
      projectHints = Array.isArray(parsed)
        ? parsed.filter((h): h is string => typeof h === "string").slice(0, 20)
        : [];
    } catch {
      projectHints = [];
    }

    if (!image && !transcript) {
      return NextResponse.json(
        { error: "Provide an image and/or transcript." },
        { status: 400 }
      );
    }

    if (image) {
      if (image.size > 8 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Image too large for analysis (max 8MB)." },
          { status: 413 }
        );
      }
      const mime = (image.type || "").toLowerCase();
      if (mime && !ALLOWED_IMAGE_TYPES.has(mime)) {
        return NextResponse.json(
          { error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." },
          { status: 415 }
        );
      }
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

    return NextResponse.json(
      { analysis },
      { headers: rateLimitHeaders(limited) }
    );
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
