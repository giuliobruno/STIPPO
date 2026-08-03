# Mobile (Stippo)

## Goal

**Screenshot → Share → Stippo → crop → annotate.**

That is the default habit on phone. No browser extension.

## Share into Stippo (Android)

1. Open Stippo in Chrome and **Add to Home screen** / Install app (required so it appears in the system Share sheet).
2. Take a normal screenshot (or open any image).
3. Tap **Share** → choose **Stippo**.
4. Crop the detail in Capture → speak/type a note → save.

The PWA `share_target` posts the image to `/share`, which hands it into Capture and opens the crop editor.

> **iOS:** Safari does not support Web Share Target the same way. On iPhone, save the screenshot, open Stippo, and use **Upload** (or wait for a native share extension later).

## Capacitor (optional native shell)

```bash
npm run build
npx cap add android   # requires Android Studio
npx cap add ios       # requires macOS + Xcode
npx cap sync
npx cap open android
```

`capacitor.config.ts` defaults `server.url` to `http://localhost:3000`.
For a physical device:

```
CAPACITOR_SERVER_URL=http://YOUR_LAN_IP:3000
```

### Native Android share receive

After `cap add android`, add an intent-filter for `SEND` + `image/*` and bridge into Capture. Until then, the installed PWA share target covers Android Chrome.

## GPS

- Site photos: EXIF GPS via `exifr`
- Capture-time: browser / Capacitor geolocation (opt-in)
- Screenshots: usually no EXIF → GPS toggle or spoken place
