import { isLocale, type Locale } from "@/i18n/config";

/** Cookie set by middleware / API with IP-derived locale suggestion */
export const GEO_LOCALE_COOKIE = "stippo.geo-locale";

/**
 * Map ISO 3166-1 alpha-2 country codes to a supported Stippo locale.
 * Unmapped countries fall back to English.
 */
const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  IT: "it",
  SM: "it",
  VA: "it",
  FR: "fr",
  MC: "fr",
  BE: "fr",
  LU: "fr",
  DE: "de",
  AT: "de",
  LI: "de",
  CH: "de",
  ES: "es",
  MX: "es",
  AR: "es",
  CO: "es",
  CL: "es",
  PE: "es",
  VE: "es",
  EC: "es",
  GT: "es",
  CU: "es",
  BO: "es",
  DO: "es",
  HN: "es",
  PY: "es",
  SV: "es",
  NI: "es",
  CR: "es",
  PA: "es",
  UY: "es",
  PR: "es",
  CN: "zh",
  TW: "zh",
  HK: "zh",
  MO: "zh",
  SG: "zh",
};

export function localeFromCountry(
  countryCode: string | null | undefined
): Locale {
  if (!countryCode) return "en";
  const code = countryCode.trim().toUpperCase();
  return COUNTRY_TO_LOCALE[code] ?? "en";
}

export function parseGeoLocaleCookie(
  value: string | null | undefined
): Locale | null {
  return isLocale(value) ? value : null;
}

/** Extract client IP from common proxy headers. */
export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  return null;
}

/** Country from edge/platform headers (Vercel, Cloudflare, etc.). */
export function countryFromHeaders(headers: Headers): string | null {
  return (
    headers.get("x-vercel-ip-country") ||
    headers.get("cf-ipcountry") ||
    headers.get("cloudfront-viewer-country") ||
    null
  );
}

function isLocalIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "localhost" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

/**
 * Resolve locale from request: platform country header → IP lookup.
 * Returns null for local/unknown IP so the client can use browser language,
 * then English as final fallback.
 */
export async function detectLocaleFromRequest(
  headers: Headers
): Promise<Locale | null> {
  const headerCountry = countryFromHeaders(headers);
  if (headerCountry && headerCountry !== "XX" && headerCountry !== "T1") {
    return localeFromCountry(headerCountry);
  }

  const ip = clientIpFromHeaders(headers);
  if (!ip || isLocalIp(ip)) return null;

  try {
    const res = await fetch(`https://api.country.is/${encodeURIComponent(ip)}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return "en";
    const data = (await res.json()) as { country?: string };
    return localeFromCountry(data.country ?? null);
  } catch {
    return "en";
  }
}
