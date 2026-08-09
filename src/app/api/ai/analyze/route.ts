import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import {
  analyzeDocument,
  analyzeImage,
  analyzeLink,
  analyzeTranscript,
  mergeAnalyses,
} from "@/lib/ai/analyze";
import { fetchPageContext } from "@/lib/ai/link-fetch";
import { extractPdfTextLight } from "@/lib/ai/pdf-text";
import { isPdfFile } from "@/lib/media/files";
import { extractUrl, normalizeHttpUrl } from "@/lib/media/url";
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

const MAX_DOC_ANALYZE_BYTES = 8 * 1024 * 1024;

/**
 * Transient AI gateway — image / url / document / transcript.
 * Bytes are NEVER persisted.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const limited = rateLimit(`ai-analyze:${user.id}`, {
      limit: 60,
      windowMs: 60 * 60 * 1000,
    });
    const ipLimited = rateLimit(clientKey(req, "ai-analyze-ip"), {
      limit: 120,
      windowMs: 60 * 60 * 1000,
    });
    if (!limited.ok) return tooManyRequests(limited);
    if (!ipLimited.ok) return tooManyRequests(ipLimited);

    const form = await req.formData();
    const image = form.get("image") as File | null;
    const document = form.get("document") as File | null;
    const transcript = String(form.get("transcript") || "").trim().slice(0, 8000);
    const fileName = String(form.get("fileName") || document?.name || "")
      .trim()
      .slice(0, 240);
    const docMime = String(
      form.get("mimeType") || document?.type || ""
    )
      .trim()
      .slice(0, 120);
    const rawUrl = String(form.get("url") || "").trim().slice(0, 2000);
    const url = normalizeHttpUrl(rawUrl) || extractUrl(rawUrl);
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

    const wantsDocument = Boolean(document || fileName);

    if (!image && !transcript && !url && !wantsDocument) {
      return NextResponse.json(
        { error: "Provide an image, url, document, and/or transcript." },
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

    if (document && document.size > MAX_DOC_ANALYZE_BYTES) {
      return NextResponse.json(
        { error: "Document too large for analysis (max 8MB). File stays in vault; add a note." },
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

    let linkResult = null;
    if (url && !image && !wantsDocument) {
      let page;
      try {
        page = await fetchPageContext(url);
      } catch (fetchErr) {
        const status = (fetchErr as { status?: number })?.status;
        if (status === 400) throw fetchErr;
        page = {
          url,
          title: "",
          description: "",
          siteName: "",
          textSnippet: "",
        };
      }
      linkResult = await analyzeLink(page, {
        voiceTranscript: transcript || undefined,
        projectHints,
      });
    }

    let documentResult = null;
    if (wantsDocument && !image) {
      let extractedText = "";
      if (
        document &&
        isPdfFile({ name: fileName || document.name, type: docMime || document.type })
      ) {
        try {
          const buf = Buffer.from(await document.arrayBuffer());
          extractedText = extractPdfTextLight(buf);
        } catch {
          extractedText = "";
        }
      }
      documentResult = await analyzeDocument(
        {
          fileName: fileName || document?.name || "document",
          mimeType: docMime || document?.type || "application/octet-stream",
          extractedText,
        },
        {
          voiceTranscript: transcript || undefined,
          projectHints,
        }
      );
    }

    let audioResult = null;
    if (transcript) {
      audioResult = await analyzeTranscript(transcript, projectHints);
    }

    const analysis = await mergeAnalyses(
      imageResult,
      audioResult,
      linkResult,
      documentResult
    );

    if (linkResult && url) {
      analysis.searchText = [analysis.searchText, url, linkResult.title]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    }
    if (documentResult && fileName) {
      analysis.searchText = [analysis.searchText, fileName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    }

    return NextResponse.json(
      { analysis, pageUrl: url || null },
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
