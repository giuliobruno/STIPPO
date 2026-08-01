import { NextResponse } from "next/server";

/** Minimal service worker registration endpoint helper — SW file is static. */
export function GET() {
  return NextResponse.json({ ok: true });
}
