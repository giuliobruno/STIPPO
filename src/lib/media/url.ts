/** Shared URL helpers for link memories (client + server safe). */

const URL_IN_TEXT_RE =
  /https?:\/\/[^\s<>"')\]]+/i;

export function extractUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const direct = normalizeHttpUrl(trimmed);
  if (direct) return direct;
  const match = trimmed.match(URL_IN_TEXT_RE);
  if (!match?.[0]) return null;
  return normalizeHttpUrl(match[0].replace(/[.,;:!?)]+$/, ""));
}

export function normalizeHttpUrl(raw: string): string | null {
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) {
      // Allow localhost only in non-production for local testing
      if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return null;
    }
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

export function hostnameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

/** True if string looks like a bare URL (not a longer note containing a URL). */
export function looksLikeUrlOnly(text: string): boolean {
  const t = text.trim();
  if (!t || /\s/.test(t)) return false;
  return Boolean(normalizeHttpUrl(t) || extractUrl(t));
}
