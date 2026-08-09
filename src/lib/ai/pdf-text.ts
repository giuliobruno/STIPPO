/**
 * Lightweight PDF text extraction — no native deps.
 * Good enough for searchable titles / first-page copy on many text PDFs.
 * Scanned/image PDFs return empty (user note remains the primary signal).
 */

const MAX_SCAN_BYTES = 2 * 1024 * 1024;
const MAX_OUT_CHARS = 4_000;

export function extractPdfTextLight(buffer: Buffer | Uint8Array): string {
  const slice =
    buffer.byteLength > MAX_SCAN_BYTES
      ? Buffer.from(buffer.buffer, buffer.byteOffset, MAX_SCAN_BYTES)
      : Buffer.from(buffer);

  // Prefer literal strings in PDF content streams: (… ) Tj / TJ
  const asLatin = slice.toString("latin1");
  const chunks: string[] = [];

  const parenRe = /\((?:\\.|[^\\)]){2,200}\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = parenRe.exec(asLatin)) && chunks.join(" ").length < MAX_OUT_CHARS) {
    chunks.push(unescapePdfString(m[0].slice(1, m[0].lastIndexOf(")"))));
  }

  const arrayRe = /\[((?:[^\[\]]|\[[^\]]*\]){2,800})\]\s*TJ/g;
  while ((m = arrayRe.exec(asLatin)) && chunks.join(" ").length < MAX_OUT_CHARS) {
    const inner = m[1];
    const parts = inner.match(/\((?:\\.|[^\\)])*\)/g) || [];
    for (const p of parts) {
      chunks.push(unescapePdfString(p.slice(1, -1)));
    }
  }

  // Fallback: /Title (…), /Subject (…), /Author (…)
  for (const key of ["Title", "Subject", "Author", "Keywords"]) {
    const meta = asLatin.match(
      new RegExp(`/${key}\\s*\\((?:\\\\.|[^\\\\)]){1,200}\\)`)
    );
    if (meta) {
      const raw = meta[0].slice(meta[0].indexOf("(") + 1, -1);
      chunks.unshift(unescapePdfString(raw));
    }
  }

  const text = chunks
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 1 && /[\p{L}\p{N}]/u.test(s))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_OUT_CHARS);

  return text;
}

function unescapePdfString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{1,3})/g, (_, oct: string) =>
      String.fromCharCode(parseInt(oct, 8))
    );
}
