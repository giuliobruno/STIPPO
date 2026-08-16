import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  countryFromHeaders,
  GEO_LOCALE_COOKIE,
  localeFromCountry,
} from "@/lib/geo-locale";
import { clientIpFromHeaders, rateLimitSync } from "@/lib/rate-limit";

/**
 * Global security headers + light edge rate damping for auth/AI/share abuse paths.
 * Detailed limits also run inside route handlers (Node + Upstash when configured).
 */

function buildCsp(isProd: boolean): string {
  // Next.js still needs 'unsafe-inline' for some runtime bootstrapping.
  // Drop 'unsafe-eval' in production to harden against XSS gadget chains.
  const scriptSrc = isProd
    ? "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com";

  const directives = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://api.dropboxapi.com https://content.dropboxapi.com https://*.dropboxapi.com https://login.microsoftonline.com https://graph.microsoft.com https://*.onedrive.com https://api.onedrive.com https://*.sharepoint.com https://api.stripe.com https://openrouter.ai https://api.openai.com https://api.country.is",
    "frame-src 'self' https://accounts.google.com https://login.microsoftonline.com https://js.stripe.com",
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
  const isProd = process.env.NODE_ENV === "production";

  if (
    pathname.startsWith("/api/auth/register") ||
    pathname.startsWith("/api/auth/forgot-password") ||
    pathname.startsWith("/api/auth/forgot-login") ||
    pathname.startsWith("/api/auth/reset-password") ||
    pathname.startsWith("/api/auth/callback/credentials") ||
    pathname.startsWith("/api/ai/") ||
    pathname === "/share" ||
    pathname.startsWith("/api/account/export")
  ) {
    const ip = clientIpFromHeaders(req.headers);
    const limit = pathname.startsWith("/api/ai/")
      ? 40
      : pathname === "/share"
        ? 30
        : 20;
    if (!rateLimitSync(`${pathname}:${ip}`, { limit, windowMs: 60_000 }).ok) {
      return NextResponse.json(
        { error: "Too many requests. Please wait and try again." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  const res = NextResponse.next();

  if (!req.cookies.get(GEO_LOCALE_COOKIE)?.value) {
    const country = countryFromHeaders(req.headers);
    if (country && country !== "XX" && country !== "T1") {
      res.cookies.set(GEO_LOCALE_COOKIE, localeFromCountry(country), {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
        secure: isProd,
      });
    }
  }

  const headers = res.headers;
  headers.set("Content-Security-Policy", buildCsp(isProd));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(self), payment=(self), interest-cohort=()"
  );
  headers.set("X-DNS-Prefetch-Control", "on");
  headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  headers.set("Cross-Origin-Resource-Policy", "same-site");

  if (isProd) {
    headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|sw.js).*)",
  ],
};
