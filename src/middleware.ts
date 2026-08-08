import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  countryFromHeaders,
  GEO_LOCALE_COOKIE,
  localeFromCountry,
} from "@/lib/geo-locale";

/**
 * Global security headers + light edge rate damping for auth/AI abuse paths.
 * Detailed limits also run inside route handlers (Node runtime).
 */

const WINDOW_MS = 60_000;
const edgeBuckets = new Map<string, { count: number; resetAt: number }>();

function edgeLimit(key: string, limit: number): boolean {
  const now = Date.now();
  let b = edgeBuckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    edgeBuckets.set(key, b);
  }
  b.count += 1;
  if (edgeBuckets.size > 5000) {
    for (const [k, v] of edgeBuckets) {
      if (v.resetAt <= now) edgeBuckets.delete(k);
    }
  }
  return b.count <= limit;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function buildCsp(): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://api.dropboxapi.com https://content.dropboxapi.com https://*.dropboxapi.com https://api.stripe.com https://openrouter.ai https://api.openai.com https://api.country.is",
    "frame-src 'self' https://accounts.google.com https://js.stripe.com",
    "worker-src 'self' blob:",
    "media-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Edge damping for high-risk write endpoints
  if (
    pathname.startsWith("/api/auth/register") ||
    pathname.startsWith("/api/auth/forgot-password") ||
    pathname.startsWith("/api/auth/forgot-login") ||
    pathname.startsWith("/api/auth/reset-password") ||
    pathname.startsWith("/api/auth/callback/credentials") ||
    pathname.startsWith("/api/ai/")
  ) {
    const ip = clientIp(req);
    const limit = pathname.startsWith("/api/ai/") ? 40 : 20;
    if (!edgeLimit(`${pathname}:${ip}`, limit)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait and try again." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  const res = NextResponse.next();

  // Suggest UI locale from edge country (IP geo). Client may still override.
  if (!req.cookies.get(GEO_LOCALE_COOKIE)?.value) {
    const country = countryFromHeaders(req.headers);
    if (country && country !== "XX" && country !== "T1") {
      res.cookies.set(GEO_LOCALE_COOKIE, localeFromCountry(country), {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
  }

  const headers = res.headers;

  headers.set("Content-Security-Policy", buildCsp());
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(self), payment=(self), interest-cohort=()"
  );
  headers.set("X-DNS-Prefetch-Control", "on");
  // allow-popups required for Google Identity Services / OAuth popups
  headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  headers.set("Cross-Origin-Resource-Policy", "same-site");

  if (process.env.NODE_ENV === "production") {
    headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Apply to all routes except Next static assets and image optimizer.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|sw.js).*)",
  ],
};
