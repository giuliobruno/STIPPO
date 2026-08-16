# Stippo — Work Visual Vault

**Project archive for architects & interior designers. On your Drive. Finally findable.**

> Capture in-app → AI tags at ingest → local vault → sync to **your** Google Drive / OneDrive / sync folder.  
> Stippo servers hold auth, billing, and a transient AI gateway — never your full-res files.

See [`docs/PRODUCT.md`](docs/PRODUCT.md) and [`docs/VAULT-PLAN.md`](docs/VAULT-PLAN.md).

---

## What's included

| Area | Status |
|---|---|
| Email auth (+ optional Google) | ✅ |
| Work vault (IndexedDB) + FTS search | ✅ |
| Capture: camera / video / clip / snapshot / import | ✅ |
| Vision at ingest via `/api/ai/analyze` (no store) | ✅ |
| Google Drive sync adapter | ✅ |
| Local folder adapter (desktop File System Access) | ✅ |
| OneDrive adapter scaffold | ✅ |
| Capacitor filesystem / network hooks | ✅ |
| Stripe Pro checkout | ✅ |
| Studio/Team scaffolding | ✅ |

---

## Quick start

Segui la guida completa: **[`docs/SETUP.md`](docs/SETUP.md)** (cosa fare tu, passo passo).

```bash
cp .env.example .env
# Set DATABASE_URL (Postgres), NEXTAUTH_SECRET, OPENROUTER_API_KEY, GOOGLE_CLIENT_ID
pnpm install
pnpm db:deploy
pnpm dev
```

1. Compila `.env` (Postgres + auth + AI + OAuth vault)
2. Signup → **/app/vault** → collega Drive / OneDrive / Dropbox
3. **/app/capture** → Photo/Video → Save
4. Installa come PWA (Chrome → Install / Aggiungi a Home)

Produzione: **Vercel + Postgres + OpenRouter** — vedi [`docs/SETUP.md`](docs/SETUP.md).

### Chiavi sicure
- `OPENAI_API_KEY` → **solo** `.env` server (mai `NEXT_PUBLIC_`)
- `GOOGLE_CLIENT_ID` / `DROPBOX_APP_KEY` / `MSAL_CLIENT_ID` → Client ID pubblici (via `/api/vault/oauth-config`)
- Non commitare `.env`

Usa **pnpm** (come le altre app dello studio), non npm.

---

## Architecture

```
Device capture
  ├─ media + thumbs  → local vault (IndexedDB / Documents/Stippo)
  ├─ AI analyze      → server gateway (transient)
  └─ sync queue      → Google Drive / local folder / OneDrive
```

Docs:
- [`docs/PRODUCT.md`](docs/PRODUCT.md)
- [`docs/VAULT-PLAN.md`](docs/VAULT-PLAN.md)
- [`docs/MOBILE.md`](docs/MOBILE.md)
