# Setup Stippo — cosa fare tu (passo passo)

Questo documento elenca **solo** le azioni che richiedono i tuoi account (Google, OpenRouter, Stripe, hosting, Postgres). Il codice è già pronto.

---

## 1. Database Postgres (obbligatorio)

SQLite non è più supportato. Crea un DB gratis:

1. **Neon** → https://neon.tech → New project → copia la connection string  
   oppure **Supabase** → Project Settings → Database → URI  
2. Incolla in `.env` come `DATABASE_URL`

Esempio:

```
DATABASE_URL="postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/stippo?sslmode=require"
```

---

## 2. Ambiente locale

```bash
cd C:\PROJECTS\STIPPO
cp .env.example .env
# Compila DATABASE_URL, NEXTAUTH_SECRET, OPENROUTER_API_KEY, NEXT_PUBLIC_GOOGLE_CLIENT_ID
pnpm install
pnpm db:deploy
pnpm dev
```

Apri http://localhost:3000

> Prima volta / schema nuovo: `pnpm db:deploy` applica le migrazioni.  
> In sviluppo puoi anche usare `pnpm db:push` se preferisci.

---

## 3. Chiavi nel file `.env` (mai in git)

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

### D) Google login NextAuth (opzionale)

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Solo se vuoi “Sign in with Google” (non serve per la sync Drive del vault).

### E) Email — Resend (obbligatorio per signup + reset)

La registrazione richiede **conferma email**. Senza Resend (o SMTP) non si completa il flusso in produzione.

**Resend + dominio (anti-spam):**

1. https://resend.com → crea API key  
2. **Domains → Add** `stippo.app`  
3. Copia i record DNS che Resend mostra (SPF, DKIM, e se c’è DMARC) in **Cloudflare → DNS**  
4. Aspetta stato **Verified** in Resend  
5. In `.env` / Vercel:

```
RESEND_API_KEY=re_...
EMAIL_FROM=Stippo <noreply@stippo.app>
EMAIL_REPLY_TO=hello@stippo.app
```

**Perché non vada in spam:**
- Usa un `EMAIL_FROM` sul dominio **verificato** (non `gmail.com`, non solo `resend.dev` in prod)
- Lascia SPF/DKIM/DMARC attivi in Cloudflare
- Evita di mandare migliaia di mail subito; parti con utenti reali

In locale senza Resend puoi usare `ALLOW_INLINE_RECOVERY=true` per vedere il link di verifica in UI.

### F) Stripe Pro (quando vuoi abbonamenti)

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

## 4. Primo uso in app

1. **Signup** su http://localhost:3000/signup  
2. Menu utente → **Work vault / cloud** (`/app/vault`)  
3. **Choose vault folder** → seleziona `Stippo` dentro Drive/Dropbox/OneDrive sul PC  
4. **Capture** → Photo o Video → nota opzionale → Save  
5. **Search** → prova “legno”, “scala”, materiali…  
6. Chrome/Edge → Install prompt oppure menu “Installa app” / “Aggiungi a Home”

---

## 5. Produzione su Vercel

1. Push del repo su GitHub  
2. [vercel.com](https://vercel.com) → Import project  
3. Environment Variables (Production):

```
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://www.stippo.app
NEXTAUTH_SECRET=<random ≥32 chars>
OPENROUTER_API_KEY=...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
RESEND_API_KEY=re_...
EMAIL_FROM=Stippo <noreply@stippo.app>
EMAIL_REPLY_TO=hello@stippo.app
```

4. Deploy — il build esegue `prisma migrate deploy` automaticamente  
5. Aggiorna origins OAuth Google con l’URL prod  
6. (Opz) Dominio custom in Vercel → Domains  
7. (Opz) Stripe webhook → `https://tuodominio/api/stripe/webhook`

### Sicurezza già nel codice

- Security headers + CSP (`src/middleware.ts`)
- Rate limit su auth / AI
- Upload media server disabilitati in prod (vault BYOS)
- Token Drive/Dropbox cifrati in IndexedDB
- Reset password inline disabilitato in prod
- Password: min 10 caratteri, lettera + numero, bcrypt cost 12

---

## 6. PWA / telefono

- **Android Chrome:** apri il sito HTTPS → Installa / Aggiungi a Home → Share Target funziona  
- **iPhone Safari:** Condividi → Aggiungi a Home (limitazioni Share Target)  
- Service worker: attivo in HTTPS / localhost (`/sw.js`)  
- Capacitor (opzionale nativo): `docs/MOBILE.md`

---

## 7. Cosa NON fare

- ❌ Mettere `OPENAI_API_KEY` / `OPENROUTER_API_KEY` in codice frontend o in `NEXT_PUBLIC_*`  
- ❌ Commitare `.env`  
- ❌ Usare SQLite / `file:` in produzione  
- ❌ Dare all’app scope Drive “full drive” (usiamo `drive.file`)  
- ❌ Aspettarsi sync Drive senza aver collegato `/app/vault`

---

## Checklist rapida

- [ ] Postgres creato (Neon/Supabase) + `DATABASE_URL`  
- [ ] `.env` creato da `.env.example`  
- [ ] `NEXTAUTH_SECRET` impostato (≥32 caratteri in prod)  
- [ ] `pnpm db:deploy` ok  
- [ ] `OPENROUTER_API_KEY` o `OPENAI_API_KEY`  
- [ ] `NEXT_PUBLIC_GOOGLE_CLIENT_ID` + Drive API abilitata  
- [ ] `pnpm dev` → signup → vault → capture → search  
- [ ] (Prod) Vercel + env + OAuth origins  
- [ ] (Prod) `RESEND_API_KEY` + `EMAIL_FROM`  
- [ ] (Opz) Stripe  
- [ ] (Opz) Install PWA sul telefono  

Dettagli prodotto: [`PRODUCT.md`](PRODUCT.md) · Architettura: [`VAULT-PLAN.md`](VAULT-PLAN.md)
