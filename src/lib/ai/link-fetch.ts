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

/**
 * Fetch public page metadata for link analysis.
 * SSRF-hardened: http(s) only, blocks private/link-local hosts, size + time limits.
 */
export async function fetchPageContext(rawUrl: string): Promise<PageContext> {
  const url = normalizeHttpUrl(rawUrl);
  if (!url) {
    throw Object.assign(new Error("Invalid URL."), { status: 400 });
  }

  assertPublicHttpUrl(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "User-Agent": "StippoLinkBot/1.0 (+https://stippo.app)",
      },
    });

    // Re-check final URL after redirects
    assertPublicHttpUrl(res.url || url);

    if (!res.ok) {
      return {
        url,
        title: "",
        description: "",
        siteName: hostnameLabel(url),
        textSnippet: "",
      };
    }

    const ctype = (res.headers.get("content-type") || "").toLowerCase();
    if (
      ctype &&
      !ctype.includes("text/html") &&
      !ctype.includes("application/xhtml") &&
      !ctype.includes("text/plain")
    ) {
      return {
        url,
        title: "",
        description: "",
        siteName: hostnameLabel(url),
        textSnippet: `Content-Type: ${ctype}`,
      };
    }

    const html = await readBodyLimited(res, MAX_BYTES);
    const meta = parseHtmlMeta(html);
    return {
      url: res.url || url,
      title: meta.title,
      description: meta.description,
      siteName: meta.siteName || hostnameLabel(url),
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
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]"
  ) {
    throw Object.assign(new Error("Local URLs are not allowed."), {
      status: 400,
    });
  }
  if (isPrivateOrReservedHost(host)) {
    throw Object.assign(new Error("Private network URLs are not allowed."), {
      status: 400,
    });
  }
}

function isPrivateOrReservedHost(host: string): boolean {
  // IPv4 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0 && parts[2] === 0) return true;
  }
  // IPv6 literals (basic)
  if (host.includes(":")) {
    if (
      host === "::1" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80")
    ) {
      return true;
    }
  }
  // Common metadata / internal DNS names
  if (
    host === "metadata.google.internal" ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    return true;
  }
  return false;
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
      chunks.push(value.subarray(0, Math.max(0, value.byteLength - (total - maxBytes))));
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
