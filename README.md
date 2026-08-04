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
pnpm install
pnpm db:push
pnpm dev
```

1. Compila `.env` (`NEXTAUTH_SECRET`, `OPENAI_API_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`)
2. Signup → **/app/vault** → collega Drive
3. **/app/capture** → Photo/Video → Save
4. Installa come PWA (Chrome → Install / Aggiungi a Home)

### Chiavi sicure
- `OPENAI_API_KEY` → **solo** `.env` server (mai `NEXT_PUBLIC_`)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` → pubblico (normale per OAuth browser)
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
