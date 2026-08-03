# Mobile / Capacitor (Visual Memory)

## Goal

Make **clip a detail from anywhere → annotate on the fly** the default habit on phone and desktop.

Hybrid Plan B still applies:
- thumbnail + AI index sync across devices
- full-res optional (Pro)

## Clip from anywhere

Stippo cannot inject a crop overlay into every other app (Teams, Acrobat, Photos…). Universal pattern:

| Context | How |
|---|---|
| Phone — any app | Screenshot or Share image → **Visual Memory** (PWA share target) → drag region |
| Phone — gallery | Bottom nav **Clip** → Create clip → pick screenshot → drag |
| Desktop — any app | OS region screenshot → paste in Capture (`Ctrl/Cmd+V`) → drag if needed |
| Desktop — browser tab | Chrome extension `extensions/chrome` (live page crop) |

In-app guide: `/app/clip-anywhere`

### In-app clip

From the bottom nav tap **Clip**, or open `/app/capture?mode=clip`:

1. Tap **Create clip** (or paste / receive a share)
2. Choose camera roll / screenshot / photo
3. Drag a rectangle over the detail
4. **Apply clip** → annotate → save

### PWA share target

`manifest.webmanifest` posts shared images to `/share`, which hands off into Capture via IndexedDB and opens the crop editor.

Install Stippo to the home screen so it appears in the OS share sheet.

## Setup (Capacitor)

```bash
npm run build
# Capacitor uses server.url pointing at your Next deployment / localhost
npx cap add android   # requires Android Studio
npx cap add ios       # requires macOS + Xcode
npx cap sync
npx cap open android
```

`capacitor.config.ts` defaults `server.url` to `http://localhost:3000`.
For a physical device, set:

```
CAPACITOR_SERVER_URL=http://YOUR_LAN_IP:3000
```

Or deploy Next.js and point Capacitor at that HTTPS URL.

## Share target flows

### PWA (Android Chrome)
POST `/share` with `image/*` (+ optional title/text/url) → Capture + crop.

### Capacitor Android
Add an intent-filter on the main activity (after `cap add android`) for:

- `android.intent.action.SEND`
- mime `image/*` and `text/plain`

Then bridge the shared URI into `/app/capture` with the image + optional text.

Suggested plugin path:
- `@capacitor/share` (outbound)
- custom intent listener / community share-receive plugin for inbound

### Deep link for quick annotate

```
/app/capture?source=share&note=scala%20interessante%20ferro%20e%20vetro%20progetto%20Milano
```

## GPS

- Site photos: EXIF GPS via `exifr`
- Capture-time: Capacitor Geolocation / browser geolocation (opt-in toggle)
- Screenshots: usually no EXIF → rely on GPS toggle or spoken place

## iOS notes

Share sheet integration needs an App Share Extension (native) for the best UX.
Capacitor alone can open the app; a Share Extension is Phase 2 polish.
Until then: screenshot → Photos → Share to Visual Memory (when PWA is installed) or Create clip from gallery.
