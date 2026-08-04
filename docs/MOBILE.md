# Mobile (Stippo Work Vault)

## Capture

1. **Photo** — in-app camera → annotate → save to vault  
2. **Video** — short clip (30s Free / 5min Pro) → keyframe vision  
3. **Import** — select work refs only (not full Camera Roll)  
4. **Screenshot share (Android)** — Add to Home → Share → Stippo → crop  

In-app guide: `/app/guide`  
Vault / cloud: `/app/vault`

## Share into Stippo (Android)

1. Chrome → **Add to Home screen**
2. Screenshot or video → **Share** → **Stippo**
3. Optional crop → note → save

> **iOS:** use Photo/Import in Capture (Safari Share Target is limited). Capacitor build recommended.

## Cloud sync

1. `/app/vault` → connect Google Drive (creates `Stippo/` folder)
2. Desktop alternative: pick a folder already synced by Drive Desktop
3. Other device → same account → **Pull**

## Capacitor

```bash
pnpm build
npx cap add android
npx cap sync
```

Required plugins: `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/network`, `@capacitor/geolocation`.

`CAPACITOR_SERVER_URL=http://YOUR_LAN_IP:3000` for a physical device.
