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

### C) Cloud vault — cartella locale (nessuna cloud key)

Non servono `GOOGLE_CLIENT_ID` / Dropbox app key.

1. Installa Drive Desktop / Dropbox / OneDrive sul PC  
2. Crea una cartella `Stippo` dentro quella cloud  
3. In app: **/app/vault** → **Choose vault folder** → seleziona quella cartella  
4. Il client cloud sincronizza in automatico  

Su telefono le capture restano nel vault del browser finché non apri Stippo sul desktop e colleghi la cartella.

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
2. Imposta le **stesse variabili** del `.env` nel pannello Environment Variables  
3. `NEXTAUTH_URL` = URL HTTPS  
4. Aggiorna origins OAuth Google con il dominio prod  
5. Deploy: collega il repo GitHub e deploy  
6. Non caricare mai `.env` su GitHub

Database auth/billing: in locale SQLite va bene; in prod preferisci Postgres (`DATABASE_URL`).

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
- [ ] `NEXTAUTH_SECRET` impostato  
- [ ] `OPENAI_API_KEY` impostata  
- [ ] `NEXT_PUBLIC_GOOGLE_CLIENT_ID` + Drive API abilitata  
- [ ] `pnpm dev` → signup → vault → capture → search  
- [ ] (Prod) hosting + env + OAuth origins  
- [ ] (Opz) Stripe  
- [ ] (Opz) Install PWA sul telefono  

Dettagli prodotto: [`PRODUCT.md`](PRODUCT.md) · Architettura: [`VAULT-PLAN.md`](VAULT-PLAN.md)
