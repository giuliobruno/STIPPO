import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalUser, requireUser, AuthError } from "@/lib/session";
import {
  resolveVaultOAuth,
  writeStoredVaultOAuth,
} from "@/lib/vault/oauth-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public OAuth client IDs for BYOS vault providers.
 * Env vars win; otherwise values saved in AppSetting (in-app setup).
 */
export async function GET() {
  try {
    const resolved = await resolveVaultOAuth();
    const user = await getOptionalUser().catch(() => null);

    return NextResponse.json({
      googleDrive: resolved.googleDrive
        ? { clientId: resolved.googleDrive.clientId }
        : null,
      dropbox: resolved.dropbox ? { appKey: resolved.dropbox.appKey } : null,
      oneDrive: resolved.oneDrive
        ? { clientId: resolved.oneDrive.clientId }
        : null,
      meta: {
        anyConfigured: resolved.anyConfigured,
        canConfigureInApp: Boolean(user),
        sources: {
          googleDrive: resolved.googleDrive?.source ?? null,
          dropbox: resolved.dropbox?.source ?? null,
          oneDrive: resolved.oneDrive?.source ?? null,
        },
        lockedByEnv: user
          ? {
              googleClientId: Boolean(
                process.env.GOOGLE_CLIENT_ID?.trim() ||
                  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()
              ),
              dropboxAppKey: Boolean(
                process.env.DROPBOX_APP_KEY?.trim() ||
                  process.env.NEXT_PUBLIC_DROPBOX_APP_KEY?.trim()
              ),
              oneDriveClientId: Boolean(
                process.env.MSAL_CLIENT_ID?.trim() ||
                  process.env.ONEDRIVE_CLIENT_ID?.trim() ||
                  process.env.NEXT_PUBLIC_MSAL_CLIENT_ID?.trim()
              ),
            }
          : undefined,
      },
    });
  } catch (err) {
    console.error("[vault/oauth-config]", err);
    return NextResponse.json({
      googleDrive: null,
      dropbox: null,
      oneDrive: null,
      meta: { anyConfigured: false, canConfigureInApp: false },
    });
  }
}

const putSchema = z.object({
  googleClientId: z.string().max(200).optional(),
  dropboxAppKey: z.string().max(200).optional(),
  oneDriveClientId: z.string().max(200).optional(),
});

/** Save public client IDs (authenticated). Env-backed values remain overrides. */
export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = putSchema.parse(await req.json());

    await writeStoredVaultOAuth(
      {
        googleClientId: body.googleClientId,
        dropboxAppKey: body.dropboxAppKey,
        oneDriveClientId: body.oneDriveClientId,
      },
      user.id
    );

    const resolved = await resolveVaultOAuth();
    return NextResponse.json({
      ok: true,
      googleDrive: resolved.googleDrive
        ? { clientId: resolved.googleDrive.clientId }
        : null,
      dropbox: resolved.dropbox ? { appKey: resolved.dropbox.appKey } : null,
      oneDrive: resolved.oneDrive
        ? { clientId: resolved.oneDrive.clientId }
        : null,
      meta: {
        anyConfigured: resolved.anyConfigured,
        canConfigureInApp: true,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message }, { status: 400 });
    }
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 500 }
    );
  }
}
