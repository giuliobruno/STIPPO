/**
 * Fetch public page metadata for link analysis.
 * SSRF-hardened: http(s) only, DNS public-IP check, decimal/hex IP block,
 * re-validate after redirects, size + time limits.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { normalizeHttpUrl } from "@/lib/media/url";

export type PageContext = {
  url: string;
  title: string;
  description: string;
  siteName: string;
  textSnippet: string;
};

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 5;

export async function fetchPageContext(rawUrl: string): Promise<PageContext> {
  const url = normalizeHttpUrl(rawUrl);
  if (!url) {
    throw Object.assign(new Error("Invalid URL."), { status: 400 });
  }

  await assertSafePublicUrl(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetchFollowingRedirects(url, controller.signal);
    const finalUrl = res.url || url;
    await assertSafePublicUrl(finalUrl);

    if (!res.ok) {
      return emptyContext(finalUrl);
    }

    const ctype = (res.headers.get("content-type") || "").toLowerCase();
    if (
      ctype &&
      !ctype.includes("text/html") &&
      !ctype.includes("application/xhtml") &&
      !ctype.includes("text/plain")
    ) {
      return {
        ...emptyContext(finalUrl),
        textSnippet: `Content-Type: ${ctype}`,
      };
    }

    const html = await readBodyLimited(res, MAX_BYTES);
    const meta = parseHtmlMeta(html);
    return {
      url: finalUrl,
      title: meta.title,
      description: meta.description,
      siteName: meta.siteName || hostnameLabel(finalUrl),
      textSnippet: meta.textSnippet,
    };
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      throw Object.assign(new Error("Timed out fetching the page."), {
        status: 504,
      });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Manual redirect follow so every hop is SSRF-checked (incl. DNS). */
async function fetchFollowingRedirects(
  startUrl: string,
  signal: AbortSignal
): Promise<Response> {
  let current = startUrl;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await assertSafePublicUrl(current);
    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "User-Agent": "StippoLinkBot/1.0 (+https://stippo.app)",
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        throw Object.assign(new Error("Invalid redirect."), { status: 400 });
      }
      current = new URL(loc, current).toString();
      try {
        await res.body?.cancel();
      } catch {
        /* ignore */
      }
      continue;
    }
    // Attach resolved URL for callers (fetch() may not set res.url with manual)
    Object.defineProperty(res, "url", { value: current, configurable: true });
    return res;
  }
  throw Object.assign(new Error("Too many redirects."), { status: 400 });
}

export async function assertSafePublicUrl(raw: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw Object.assign(new Error("Invalid URL."), { status: 400 });
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw Object.assign(new Error("Only http(s) URLs are allowed."), {
      status: 400,
    });
  }
  if (u.username || u.password) {
    throw Object.assign(new Error("URLs with credentials are not allowed."), {
      status: 400,
    });
  }

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  assertHostNotLiteralPrivate(host);

  const resolved = await resolvePublicAddresses(host);
  for (const addr of resolved) {
    if (isPrivateIp(addr)) {
      throw Object.assign(new Error("Private network URLs are not allowed."), {
        status: 400,
      });
    }
  }
}

/** Sync host checks used by tests / callers that only have a hostname. */
export function assertPublicHttpUrl(raw: string): void {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw Object.assign(new Error("Invalid URL."), { status: 400 });
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw Object.assign(new Error("Only http(s) URLs are allowed."), {
      status: 400,
    });
  }
  assertHostNotLiteralPrivate(u.hostname.toLowerCase().replace(/^\[|\]$/g, ""));
}

function assertHostNotLiteralPrivate(host: string): void {
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "metadata.google.internal" ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    throw Object.assign(new Error("Local URLs are not allowed."), {
      status: 400,
    });
  }

  // Decimal / octal / hex IP forms (e.g. 2130706433, 0x7f000001)
  if (/^0x[0-9a-f]+$/i.test(host) || /^0[0-7]+$/.test(host) || /^\d+$/.test(host)) {
    const asNum = host.startsWith("0x")
      ? Number.parseInt(host, 16)
      : host.startsWith("0") && host.length > 1
        ? Number.parseInt(host, 8)
        : Number.parseInt(host, 10);
    if (Number.isFinite(asNum) && asNum >= 0 && asNum <= 0xffffffff) {
      const a = (asNum >>> 24) & 255;
      const b = (asNum >>> 16) & 255;
      const c = (asNum >>> 8) & 255;
      const d = asNum & 255;
      const dotted = `${a}.${b}.${c}.${d}`;
      if (isPrivateIp(dotted)) {
        throw Object.assign(new Error("Private network URLs are not allowed."), {
          status: 400,
        });
      }
    }
  }

  const ipVersion = isIP(host);
  if (ipVersion && isPrivateIp(host)) {
    throw Object.assign(new Error("Private network URLs are not allowed."), {
      status: 400,
    });
  }
}

async function resolvePublicAddresses(host: string): Promise<string[]> {
  if (isIP(host)) return [host];
  try {
    const results = await lookup(host, { all: true, verbatim: true });
    if (!results.length) {
      throw Object.assign(new Error("Host could not be resolved."), {
        status: 400,
      });
    }
    return results.map((r) => r.address);
  } catch (err) {
    if ((err as { status?: number })?.status === 400) throw err;
    throw Object.assign(new Error("Host could not be resolved."), {
      status: 400,
    });
  }
}

function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b, c] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b! >= 16 && b! <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b! >= 64 && b! <= 127) return true;
    if (a === 192 && b === 0 && c === 0) return true;
    if (a === 192 && b === 0 && c === 2) return true; // TEST-NET
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a! >= 224) return true; // multicast / reserved
    return false;
  }
  if (v === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized === "::") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
    if (normalized.startsWith("fe80")) return true; // link-local
    if (normalized.startsWith("ff")) return true; // multicast
    // IPv4-mapped
    if (normalized.includes(".")) {
      const mapped = normalized.split(":").pop();
      if (mapped && isIP(mapped) === 4) return isPrivateIp(mapped);
    }
    return false;
  }
  return false;
}

function emptyContext(url: string): PageContext {
  return {
    url,
    title: "",
    description: "",
    siteName: hostnameLabel(url),
    textSnippet: "",
  };
}

async function readBodyLimited(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    return text.slice(0, maxBytes);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      chunks.push(
        value.subarray(0, Math.max(0, value.byteLength - (total - maxBytes)))
      );
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      break;
    }
    chunks.push(value);
  }
  const merged = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return merged.toString("utf8");
}

function parseHtmlMeta(html: string): {
  title: string;
  description: string;
  siteName: string;
  textSnippet: string;
} {
  const head = html.slice(0, 120_000);
  const ogTitle =
    metaContent(head, "og:title") ||
    metaContent(head, "twitter:title") ||
    titleTag(head);
  const ogDesc =
    metaContent(head, "og:description") ||
    metaContent(head, "twitter:description") ||
    metaContent(head, "description");
  const siteName = metaContent(head, "og:site_name");
  const textSnippet = stripTags(head)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);

  return {
    title: decodeEntities(ogTitle).slice(0, 200),
    description: decodeEntities(ogDesc).slice(0, 500),
    siteName: decodeEntities(siteName).slice(0, 120),
    textSnippet,
  };
}

function metaContent(html: string, prop: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapeReg(prop)}["'][^>]*content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escapeReg(prop)}["'][^>]*>`,
    "i"
  );
  const m = html.match(re);
  return (m?.[1] || m?.[2] || "").trim();
}

function titleTag(html: string): string {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return (m?.[1] || "").trim();
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hostnameLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}
