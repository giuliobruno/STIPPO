import { NextResponse } from "next/server";

/**
 * Public OAuth client IDs for BYOS vault providers.
 * Secrets never leave the server; SPA/PKCE flows only need these IDs.
 */
export function GET() {
  const googleClientId =
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    "";
  const dropboxAppKey =
    process.env.DROPBOX_APP_KEY?.trim() ||
    process.env.NEXT_PUBLIC_DROPBOX_APP_KEY?.trim() ||
    "";
  const oneDriveClientId =
    process.env.MSAL_CLIENT_ID?.trim() ||
    process.env.ONEDRIVE_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_MSAL_CLIENT_ID?.trim() ||
    "";

  return NextResponse.json({
    googleDrive: googleClientId ? { clientId: googleClientId } : null,
    dropbox: dropboxAppKey ? { appKey: dropboxAppKey } : null,
    oneDrive: oneDriveClientId ? { clientId: oneDriveClientId } : null,
  });
}
