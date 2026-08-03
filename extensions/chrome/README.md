# Stippo Clip (Chrome extension)

Region clip from a browser tab → Stippo `/app/capture` with source URL/title.

For PDF / Teams / Photos / any other app on the device, use OS screenshot → paste or Share into Stippo (see in-app **Clip from anywhere** guide). This extension is for **live browser tabs**.

## Install (unpacked)

1. Start Stippo (`npm run dev` → http://localhost:3000)
2. Chrome → `chrome://extensions` → enable **Developer mode**
3. **Load unpacked** → select this folder (`extensions/chrome`)
4. Open the popup → confirm **App origin** (default `http://localhost:3000`)
5. On any site → **Clip region**, right-click → **Clip region to Stippo**, or `Alt+Shift+S` → drag a rectangle
6. Stippo opens Capture with the clipped image; annotate and save

## Flow

```
captureVisibleTab → overlay crop → chrome.storage.session
  → open /app/capture?source=extension
  → bridge.js postMessage / IndexedDB
  → CaptureForm ingest
```

## Production origin

Set **App origin** in the popup to your deployed HTTPS URL. The service worker registers a content-script bridge for that origin.

## Notes

- Cannot clip `chrome://` / Web Store pages (Chrome restriction)
- In-browser PDFs work when Chrome can capture the visible tab
- User must be logged into Stippo in that origin
- Hybrid Plan B still applies: thumbnail + AI index sync; full-res Pro opt-in
