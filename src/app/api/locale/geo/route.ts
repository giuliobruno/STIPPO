import { NextResponse } from "next/server";
import {
  detectLocaleFromRequest,
  GEO_LOCALE_COOKIE,
} from "@/lib/geo-locale";

/**
 * Suggest a UI locale from the visitor IP / edge country headers.
 * Returns { locale: null } for local IPs (client falls back to browser → English).
 */
export async function GET(req: Request) {
  const locale = await detectLocaleFromRequest(req.headers);
  const res = NextResponse.json({ locale });
  if (locale) {
    res.cookies.set(GEO_LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}
