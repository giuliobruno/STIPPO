# Mobile (Stippo)

## Capture

1. **Album** — pick any photo → speak/type a note → save  
2. **Camera** — shoot now → annotate → save  
3. **Screenshot share (Android)** — Add Stippo to Home screen → screenshot → Share → Stippo  

In-app guide: `/app/guide`

Crop is optional after an image is loaded.

## Share into Stippo (Android)

1. Chrome → **Add to Home screen** (required for the Share sheet)
2. Screenshot → **Share** → **Stippo**
3. Optional crop → note → save

> **iOS:** use **Album** in Capture (Safari does not expose Web Share Target the same way).

## Capacitor (optional)

```bash
npm run build
npx cap add android
npx cap sync
```

`CAPACITOR_SERVER_URL=http://YOUR_LAN_IP:3000` for a physical device.
