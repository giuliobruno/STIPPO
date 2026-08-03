import { CLIP_MESSAGE_TYPE } from "@/lib/media/clip-bridge";

export const runtime = "nodejs";

/**
 * PWA Web Share Target endpoint.
 * Receives shared images/text from the OS share sheet, then hands off to Capture
 * via IndexedDB (same bridge as the Chrome extension).
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const title = String(form.get("title") || "").trim();
  const text = String(form.get("text") || form.get("note") || "").trim();
  const url = String(form.get("url") || "").trim();
  const file = pickSharedImage(form);

  if (file) {
    if (file.size > 12 * 1024 * 1024) {
      return new Response("Shared image is too large (max 12MB).", {
        status: 413,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "image/png";
    const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;

    return htmlHandoff({
      dataUrl,
      sourceUrl: url,
      sourceTitle: title,
      note: text,
      openCrop: true,
      source: "share",
    });
  }

  const dest = new URL("/app/capture", req.url);
  dest.searchParams.set("source", "share");
  dest.searchParams.set("mode", "clip");
  if (text) dest.searchParams.set("note", text);
  if (url) dest.searchParams.set("sourceUrl", url);
  if (title) dest.searchParams.set("sourceTitle", title);
  return Response.redirect(dest, 303);
}

function pickSharedImage(form: FormData): File | null {
  const keys = ["media", "file", "files", "image"];
  for (const key of keys) {
    const value = form.get(key);
    if (value instanceof File && value.size > 0 && value.type.startsWith("image/")) {
      return value;
    }
  }
  for (const [, value] of form.entries()) {
    if (value instanceof File && value.size > 0 && value.type.startsWith("image/")) {
      return value;
    }
  }
  return null;
}

function htmlHandoff(payload: {
  dataUrl: string;
  sourceUrl?: string;
  sourceTitle?: string;
  note?: string;
  openCrop?: boolean;
  source?: "share" | "screenshot";
}) {
  const message = {
    type: CLIP_MESSAGE_TYPE,
    dataUrl: payload.dataUrl,
    sourceUrl: payload.sourceUrl || "",
    sourceTitle: payload.sourceTitle || "",
    note: payload.note || "",
    clipRect: null,
    openCrop: Boolean(payload.openCrop),
    source: payload.source || "share",
  };

  const json = JSON.stringify(message).replace(/</g, "\\u003c");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opening Stippo…</title>
  <style>
    body { font: 15px/1.4 system-ui, sans-serif; background: #f3f1ec; color: #141414;
      display: grid; place-items: center; min-height: 100vh; margin: 0; }
  </style>
</head>
<body>
  <p>Opening Stippo Capture…</p>
  <script>
    (function () {
      var payload = ${json};
      function go() {
        location.replace("/app/capture?source=share&mode=clip");
      }
      try {
        var req = indexedDB.open("stippo-clip", 1);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains("pending")) db.createObjectStore("pending");
        };
        req.onsuccess = function () {
          var db = req.result;
          var tx = db.transaction("pending", "readwrite");
          tx.objectStore("pending").put(payload, "clip");
          tx.oncomplete = function () {
            db.close();
            window.postMessage(payload, location.origin);
            go();
          };
          tx.onerror = go;
        };
        req.onerror = go;
      } catch (e) {
        go();
      }
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
