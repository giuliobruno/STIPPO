# Stippo Vault — Piano d'azione

> **Status implementazione (codebase):** Fasi 0–6 scaffoldate.  
> Vault locale + AI gateway + Drive / OneDrive / Dropbox / local adapters + video/clip + Studio hooks sono nel codice.  
> Produzione cloud richiede i Client ID OAuth in `.env` (`GOOGLE_CLIENT_ID`, `MSAL_CLIENT_ID`, `DROPBOX_APP_KEY`) + redirect URI verificati.

> **Posizionamento:** app di lavoro per architetti. Archivio visivo separato dal rullino personale.  
> **Storage:** cartella vault sul cloud dell'utente (BYOS). Server Stippo = auth + billing + AI gateway.  
> **Capture:** camera e strumenti clip **in-app** → ogni asset sa dove vive.

---

## Implementation map

| Fase | Codice |
|------|--------|
| 0 Ripositioning | `docs/PRODUCT.md`, landing, guide, AppShell |
| 1 Vault locale | `src/lib/vault/*`, CaptureForm → vault, SearchPanel FTS |
| 2 Capacitor | `@capacitor/filesystem`, `@capacitor/network`, `native.ts` |
| 3 Google Drive | `adapters/google-drive.ts`, `/app/vault`, sync queue |
| 4 Video/clip/snapshot | `video.ts`, CaptureForm video, share_target `video/*` |
| 5 Desktop + OneDrive | `adapters/local-folder.ts`, `adapters/onedrive.ts` |
| 6 Studio | `src/lib/vault/studio.ts` |

---

## 1. Principi non negoziabili

| # | Principio | Perché |
|---|-----------|--------|
| 1 | **Capture in-app** | Separazione lavoro/personale; ogni file passa dalla pipeline |
| 2 | **Local-first** | Cantiere offline; salva subito, sync dopo |
| 3 | **Vault unico syncabile** | `vault.db` + `media/` viaggiano insieme — mai foto senza indice |
| 4 | **Cloud dell'utente** | Zero storage cost per Stippo; GDPR; multi-device via Drive/OneDrive |
| 5 | **Vision a ingest** | Ogni immagine/frame video analizzato una volta → tag visivi ritrovabili |
| 6 | **Server senza byte** | AI gateway transiente; nessuna foto persistita lato Stippo |

---

## 2. Struttura vault (cloud-agnostic)

Cartella scelta dall'utente al setup (es. `Google Drive/Stippo/`):

```
Stippo/
├── vault.db              # SQLite: memories, projects, tags, searchText, sync state
├── vault.meta.json       # versione schema, deviceId, lastSync, cloudProvider
├── media/
│   ├── {memoryId}.jpg    # foto full-res
│   ├── {memoryId}.mp4    # video / clip
│   ├── {memoryId}.webm   # clip brevi da schermo (desktop)
│   └── {memoryId}.m4a    # nota vocale standalone (opzionale)
├── thumbs/
│   └── {memoryId}.jpg    # anteprima 720px (immagine o frame video)
├── frames/               # keyframe estratti per AI (opzionale, dedup)
│   └── {memoryId}-0.jpg
└── .stippo-sync/         # coda upload, checkpoint, conflitti (gitignore-style)
    ├── queue.json
    └── locks/
```

**vault.db** sostituisce Postgres per i dati utente. Il server tiene solo `User` + Stripe.

Schema memoria esteso:

| Campo | Tipo media |
|-------|------------|
| `mediaType` | `image` \| `video` \| `clip` \| `snapshot` \| `audio` |
| `durationMs` | video/clip/audio |
| `width`, `height` | tutti i visual |
| `source` | `camera` \| `clip` \| `snapshot` \| `share` \| `paste` \| `import` |
| `localPath` | path relativo in `media/` |
| `cloudPath` | path remoto dopo sync |
| `syncState` | `local` \| `queued` \| `synced` \| `conflict` |
| `contentHash` | SHA-256 per dedup e integrità |

---

## 3. Tipi di capture supportati

| Tipo | Input | Pipeline | Note |
|------|-------|----------|------|
| **Photo** | Camera in-app | thumb → vision → vault | Flusso primario |
| **Snapshot** | Screenshot OS → Share → Stippo | crop opzionale → vision → vault | Già parziale (`/share`) |
| **Clip** | Crop da screenshot / immagine web | rect salvato in metadata → vision | `clipRectJson` esiste |
| **Video** | Camera in-app (modalità video) | poster frame → vision su frame → vault | Max 60s Free / 5min Pro |
| **Screen clip** | Desktop: paste / region capture | webm o png → vault | Fase desktop |
| **Import** | Selezione multipla galleria/file | batch queue → vision each | Solo ref lavoro, non rullino intero |
| **Voice-only** | Mic senza immagine | transcript → entità | `mediaType: audio` |

Estensioni share target (`manifest.json` + `/share`):

- `image/*` ✓ (oggi)
- `video/*` — Fase 4
- `text/plain` + url — bookmark con preview

---

## 4. Architettura sync — superare ogni ostacolo

### 4.1 Pattern: Sync Adapter

```typescript
interface VaultSyncAdapter {
  id: "google_drive" | "onedrive" | "local_folder" | "icloud_files";
  connect(): Promise<VaultLocation>;      // OAuth o folder picker
  push(file: VaultFile, localPath: Buffer): Promise<RemoteRef>;
  pull(remoteRef: RemoteRef): Promise<Buffer>;
  list(prefix: string): Promise<RemoteRef[]>;
  watch?(onChange: ChangeHandler): Unsubscribe;  // desktop webhook/polling
}
```

| Ostacolo | Soluzione smart |
|----------|-----------------|
| Mobile sync manuale impossibile | **Adapter Google Drive**: upload automatico post-cattura |
| Desktop senza OAuth | **Adapter `local_folder`**: scrive in cartella già syncata da Drive Desktop |
| Offline cantiere | **Coda locale** in `.stippo-sync/queue.json`; retry exponential backoff |
| Conflitti 2 device | **Last-write-wins** su `updatedAt` + merge per campo su tag utente; log conflitti in UI |
| vault.db corrotto | **WAL mode** SQLite; backup `vault.db.bak` prima di ogni merge |
| Video grandi | **Chunked upload** Drive API resumable; limite dimensione per tier |
| iOS sandbox | **Capacitor** + `@capacitor/filesystem` in Directory.Documents esposto a Files app |
| PWA limitata | PWA = companion web (consultazione); capture nativa richiede app installata |
| Ricerca cross-device | **FTS5** su `vault.db` — stesso file syncato, ricerca locale ovunque |
| AI senza storage server | POST `/api/ai/analyze` → bytes in memoria → JSON tags out → mai persistiti |
| Primo avvio su device nuovo | Wizard: "Collega stesso Drive" → download vault.db + thumbs → media on-demand |
| Utente cancella file su Drive | **Integrity scan** periodico; badge "file mancante" + re-upload da locale se esiste |

### 4.2 Flusso capture → cloud

```
[Camera / Clip / Video]
        │
        ▼
┌───────────────────┐
│ 1. Write locale   │  media/ + thumbs/ + riga vault.db (syncState: local)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 2. AI gateway     │  vision / frame / transcript → aggiorna searchText, tags
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 3. Enqueue sync   │  .stippo-sync/queue.json
└─────────┬─────────┘
          │
          ▼ (rete disponibile)
┌───────────────────┐
│ 4. Adapter push   │  vault.db + nuovi media/ → cloud folder
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 5. Mark synced    │  syncState: synced, cloudPath set
└───────────────────┘
```

### 4.3 Strategia per piattaforma

| Piattaforma | App | Sync | Capture |
|-------------|-----|------|---------|
| **Android** | Capacitor | Google Drive API automatico | Camera nativa + Share Target |
| **iOS** | Capacitor | Google Drive / iCloud Files | Camera nativa + Share Extension (fase 2) |
| **Desktop Win/Mac** | Tauri leggero o PWA + folder | Cartella locale = Drive Desktop sync | Paste snapshot, screen clip |
| **Web** | PWA consultazione | Drive OAuth read + search | Solo import limitato |

---

## 5. AI pipeline per ogni media type

| Media | Analisi | Costo stimato | Output in searchText |
|-------|---------|---------------|----------------------|
| Photo | gpt-4o-mini vision low | ~$0.002 | tags visivi + OCR |
| Snapshot/clip | idem + clipRect metadata | ~$0.002 | + sourceUrl, sourceTitle |
| Video ≤60s | 3 keyframe (0s, metà, fine) → vision ciascuno | ~$0.006 | tags + transcript se audio |
| Video audio | Whisper API o Web Speech post-capture | ~$0.003/min | transcript |
| Voice-only | gpt-4o-mini text | ~$0.0003 | entità, intent |
| Ricerca | **FTS5** su vault.db | $0 | keyword + tag vision |

**Regola:** vision **sempre** a ingest. Niente embedding server-side (FTS5 basta per MVP).

Gate Pro:
- Free: 100 memorie, video max 30s, 1 keyframe
- Pro: illimitato, video 5min, 3 keyframe, batch import

---

## 6. Server minimo

```
/api/auth/*          → NextAuth (email + Google login)
/api/stripe/*        → billing
/api/ai/analyze      → image | frame | transcript in → JSON out (no store)
/api/ai/transcribe   → audio chunk → text (Pro / video)
/health              → status
```

**Rimosso dal server:** storage media, Postgres memories, search index cloud.

Opzionale futuro: `/api/sync/token` — refresh token cloud cifrato (zero-knowledge preferibile: token solo on-device).

---

## 7. Fasi di implementazione

### Fase 0 — Ripositioning (1 settimana)
- [ ] Aggiornare `PRODUCT.md`: work vault, BYOS, no rullino
- [ ] Copy UI: "Archivio lavoro sul tuo Drive"
- [ ] Camera in-app come CTA primaria; upload/import secondario
- [ ] Rimuovere positioning "Google Photos competitor"

### Fase 1 — Vault locale (2–3 settimane)
- [ ] Modulo `src/lib/vault/` — SQLite WASM o better-sqlite via Capacitor
- [ ] Schema `vault.db` migrato da Prisma Memory + Project
- [ ] Capture → scrive in vault locale (non server filesystem)
- [ ] FTS5 search locale (`src/lib/vault/search.ts`)
- [ ] Export/import vault folder zip (backup manuale)
- [ ] Vision obbligatoria a ingest; rimuovi embedding da pipeline

### Fase 2 — Capacitor nativo (2 settimane)
- [ ] `@capacitor/camera` — photo + video capture
- [ ] `@capacitor/filesystem` — vault in Documents
- [ ] `@capacitor/network` — online/offline detection
- [ ] Background sync queue con retry
- [ ] Share Target: estendi video/* oltre image/*

### Fase 3 — Google Drive sync (2–3 settimane)
- [ ] OAuth `drive.file` scope (solo cartella Stippo)
- [ ] Setup wizard: "Scegli / crea cartella Stippo su Drive"
- [ ] `GoogleDriveSyncAdapter`: push/pull vault.db + media/
- [ ] Resumable upload per video
- [ ] Second device: "Collega stesso account Drive" → pull vault.db
- [ ] UI: stato sync (locale / in coda / sincronizzato / errore)

### Fase 4 — Video, clip, snapshot (2 settimane)
- [ ] `mediaType: video | clip | snapshot` in vault schema
- [ ] Estrazione keyframe client-side (`canvas` / ffmpeg.wasm lite)
- [ ] Poster thumbnail da frame 0
- [ ] Player inline in Memory detail
- [ ] Limiti durata Free vs Pro
- [ ] Screen clip desktop (paste → crop → save)

### Fase 5 — Desktop + OneDrive (2–3 settimane)
- [ ] Adapter `local_folder` — picker cartella syncata Drive Desktop
- [ ] OneDrive adapter (Graph API) — stesso pattern di Drive
- [ ] File watcher desktop (opzionale) per sync bidirezionale soft

### Fase 6 — Team / Studio (post-PMF)
- [ ] Cartella Drive condivisa studio
- [ ] vault.db multi-user read (O lock ottimistico)
- [ ] Tier Team $49/mo

---

## 8. UX wizard setup (prima apertura)

```
Step 1 — Benvenuto
  "Stippo è il tuo archivio visivo di lavoro.
   Separato dalle foto personali. Sul tuo cloud."

Step 2 — Scegli cloud
  [ Google Drive ]  [ OneDrive ]  [ Cartella locale (desktop) ]

Step 3 — Scegli / crea cartella
  "Stippo/Archivio Lavoro"  [ Cambia ]

Step 4 — Permessi camera
  "Le foto lavoro si scattano qui — non vanno nel rullino."

Step 5 — Pronto
  [ Scatta first reference ]
```

---

## 9. Metriche di successo

| Metrica | Target 90gg |
|---------|-------------|
| Capture in-app vs import | >80% in-app |
| Sync success rate | >95% |
| Tempo capture → searchable | <5s offline, <15s online |
| Costo AI / utente attivo / mese | <$0.50 |
| Conversione Free → Pro | >5% |
| Vault corruption / sync conflict | <0.1% sessions |

---

## 10. Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Google OAuth verification lenta | Scope `drive.file` minimo; documentazione privacy early |
| Video troppo pesanti | Limite durata + compressione client H.264 |
| ffmpeg.wasm lento su mobile | Keyframe via `<video>` + canvas, no ffmpeg su phone |
| Utente disinstalla app, vault resta su Drive | Feature, non bug — dati su Drive |
| Perdita vault.db | Auto-backup `vault.db.bak`; export zip mensile reminder |
| AI cost spike import batch | Batch import = Pro only; rate limit |

---

## 11. Cosa NON fare

- ❌ Indicizzare rullino camera
- ❌ Storage media su server Stippo
- ❌ Competere con Google Photos su ricerca visiva passiva
- ❌ PWA-only per capture mobile (Capacitor obbligatorio)
- ❌ Sync manuale "ricordati di caricare su Drive" su mobile
- ❌ Embedding / vector DB cloud (FTS5 sufficiente con vision tags)

---

## 12. Stack tecnico riassuntivo

| Layer | Scelta |
|-------|--------|
| Mobile app | Capacitor 6 + Next.js shell |
| Vault DB | SQLite (FTS5) in cartella sync |
| Sync | Adapter pattern; Google Drive first |
| AI | gpt-4o-mini vision + FTS5; gateway server-side |
| Auth/Billing | NextAuth + Stripe (server) |
| Desktop | Tauri o folder watch (fase 5) |
| Search | Locale FTS5 — zero server |

---

*Documento vivo — aggiornare ad ogni fase completata.*

## Codice completato (agent)

- [x] Fase 0–6 vault / BYOS / video / studio scaffold  
- [x] PWA service worker (`public/sw.js`) + install prompt  
- [x] Vault bootstrap + sync on `online`  
- [x] Setup utente: [`docs/SETUP.md`](SETUP.md)  
