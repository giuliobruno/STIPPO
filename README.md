# Visual Memory AI

**Project visual memory for architects & interior designers.**

Snap a detail. Speak the thought. Ask months later.

> Hybrid Plan B: originals stay local by default. Thumbnail + understanding sync across devices. Full-res sync is a Pro opt-in.

---

## What's included

| Area | Status |
|---|---|
| Email auth (+ optional Google) | ✅ |
| Capture: camera / upload / paste screenshot | ✅ |
| In-app region clip (crop before save) | ✅ |
| Chrome extension region clip → Capture | ✅ |
| On-the-fly voice/text annotation (native STT) | ✅ |
| GPS opt-in + EXIF GPS from site photos | ✅ |
| Hybrid sync (thumbnail + index; full-res Pro) | ✅ |
| Projects + AI suggest | ✅ |
| Hybrid search | ✅ |
| Stripe Pro checkout / portal / webhooks | ✅ |
| PWA share_target + Capacitor scaffold | ✅ |
| Free 100-memory gate | ✅ |

---

## Quick start

```bash
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

Open http://localhost:3000 → signup → **Capture**

Try:
1. Paste a screenshot (`Ctrl/Cmd+V`)
2. Speak or type: `scala interessante ferro e vetro progetto Milano`
3. Toggle location (EXIF or GPS)
4. Save → Search for `ferro vetro Milano`

### Real AI
```
OPENAI_API_KEY=sk-...
```

### Stripe Pro
1. Create a $15/mo Price in Stripe
2. Set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_WEBHOOK_SECRET`
3. Forward webhooks: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
4. Open **/app/billing**

### Mobile (Capacitor)
See [`docs/MOBILE.md`](docs/MOBILE.md)

```bash
npx cap add android
npx cap sync
```

---

## Architecture (Plan B)

```
Device capture (photo/screenshot + STT + optional GPS)
        │
        ├─ original  → local storage (default)
        ├─ thumbnail → synced preview (all devices)
        └─ AI index  → DB (title, tags, entities, embedding, geo)
        │
        ▼
Any device: search + thumbnail preview
Pro opt-in: sync full-resolution original
```

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run db:push` | Sync Prisma schema |
| `npm run db:studio` | Browse DB |

---

## Docs

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — product principles
- [`docs/MOBILE.md`](docs/MOBILE.md) — Capacitor / share sheet
- [`extensions/chrome/README.md`](extensions/chrome/README.md) — Stippo Clip browser extension
