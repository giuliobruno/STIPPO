# Setup Stippo — cosa fare tu (passo passo)

Questo documento elenca **solo** le azioni che richiedono i tuoi account (Google, OpenAI, Stripe, hosting). Il codice è già pronto.

---

## 1. Ambiente locale (obbligatorio)

```bash
cd C:\PROJECTS\STIPPO
cp .env.example .env
pnpm install
pnpm db:push
pnpm dev
```

Apri http://localhost:3000

---

## 2. Chiavi nel file `.env` (mai in git)

Apri `.env` e compila:

### A) Auth (obbligatorio)

```
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="incolla-una-stringa-lunga-casuale"
```

Genera il secret (PowerShell):

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

In **produzione** cambia `NEXTAUTH_URL` con il dominio HTTPS reale (es. `https://app.stippo.it`).

### B) AI — OpenRouter (consigliato) oppure OpenAI

**OpenRouter** (una chiave → tanti modelli, spesso più economico):

1. https://openrouter.ai/keys → crea una key  
2. In `.env`:

```
OPENROUTER_API_KEY="sk-or-v1-..."
OPENROUTER_VISION_MODEL="openai/gpt-4o-mini"
OPENROUTER_EMBEDDING_MODEL="openai/text-embedding-3-small"
```

**Oppure OpenAI diretto** (se non usi OpenRouter):

```
OPENAI_API_KEY="sk-..."
```

Se è presente `OPENROUTER_API_KEY`, ha la priorità.

**Sicurezza:** queste chiavi restano **solo** nel `.env` del server.  
Non usare `NEXT_PUBLIC_`. Se leak → revoca e ricrea.

Senza nessuna chiave AI l’app funziona in modalità mock.

### C) Vault Google Drive — una volta sola (script)

```powershell
pnpm setup:drive
```

Lo script apre le pagine Google, ti chiede il Client ID e lo scrive nel `.env`.  
Poi: `pnpm dev` → `/app/vault` → **Usa il mio Google Drive**.

Gli architetti non lanciano lo script: premono solo il pulsante e fanno login.

---

### D) Google login NextAuth (opzionale)

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Solo se vuoi “Sign in with Google” (non serve per la sync Drive del vault).

### E) Stripe Pro (quando vuoi abbonamenti)

1. Stripe Dashboard → Product → Price $15/mo  
2. In `.env`:

```
STRIPE_SECRET_KEY=sk_...
STRIPE_PRICE_PRO=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
```

3. Webhook locale: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

---

## 3. Primo uso in app

1. **Signup** su http://localhost:3000/signup  
2. Menu utente → **Work vault / cloud** (`/app/vault`)  
3. **Choose vault folder** → seleziona `Stippo` dentro Drive/Dropbox/OneDrive sul PC  
4. **Capture** → Photo o Video → nota opzionale → Save  
5. **Search** → prova “legno”, “scala”, materiali…  
6. Chrome/Edge → Install prompt oppure menu “Installa app” / “Aggiungi a Home”

---

## 4. Produzione (quando sei pronto)

1. Hosting consigliato: **Vercel** (Next.js)  
2. Database: **Postgres** obbligatorio (SQLite `file:` è bloccato in prod)  
3. Imposta le variabili nel pannello Environment Variables (vedi sotto)  
4. `NEXTAUTH_URL` = URL HTTPS  
5. Aggiorna origins OAuth Google con il dominio prod  
6. Configura email reset (`RESEND_API_KEY` o SMTP) — senza mailer i reset non partono in prod  
7. Deploy: collega il repo GitHub e deploy  
8. Non caricare mai `.env` su GitHub

### Env minime in produzione

```
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://tuodominio
NEXTAUTH_SECRET=<random ≥32 chars>
OPENROUTER_API_KEY=...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
RESEND_API_KEY=...   # o SMTP_*
```

### Sicurezza già nel codice

- Security headers + CSP (`src/middleware.ts`)
- Rate limit su auth / AI
- Upload media server disabilitati in prod (vault BYOS)
- Token Drive/Dropbox cifrati in IndexedDB (non più plaintext in `localStorage`)
- Reset password inline disabilitato in prod
- Password: min 10 caratteri, lettera + numero, bcrypt cost 12

---

## 5. PWA / telefono

- **Android Chrome:** apri il sito HTTPS → Installa / Aggiungi a Home → Share Target funziona  
- **iPhone Safari:** Condividi → Aggiungi a Home (limitazioni Share Target)  
- Service worker: attivo in HTTPS / localhost (`/sw.js`)  
- Capacitor (opzionale nativo): `docs/MOBILE.md`

---

## 6. Cosa NON fare

- ❌ Mettere `OPENAI_API_KEY` in codice frontend o in `NEXT_PUBLIC_*`  
- ❌ Commitare `.env`  
- ❌ Dare all’app scope Drive “full drive” (usiamo `drive.file`)  
- ❌ Aspettarsi sync Drive senza aver collegato `/app/vault`

---

## Checklist rapida

- [ ] `.env` creato da `.env.example`  
- [ ] `NEXTAUTH_SECRET` impostato (≥32 caratteri in prod)  
- [ ] `OPENROUTER_API_KEY` o `OPENAI_API_KEY`  
- [ ] `NEXT_PUBLIC_GOOGLE_CLIENT_ID` + Drive API abilitata  
- [ ] `pnpm dev` → signup → vault → capture → search  
- [ ] (Prod) Vercel + Postgres + env + OAuth origins  
- [ ] (Prod) `RESEND_API_KEY` o SMTP per reset password  
- [ ] (Opz) Stripe  
- [ ] (Opz) Install PWA sul telefono  

Dettagli prodotto: [`PRODUCT.md`](PRODUCT.md) · Architettura: [`VAULT-PLAN.md`](VAULT-PLAN.md)
