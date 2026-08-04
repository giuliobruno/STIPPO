# Stippo — Product & Engineering Spec

## Positioning

**Not:** Google Photos clone / Camera Roll indexer / generic AI second brain  
**Is:** work visual vault for architects & interior designers — separate from birthday photos

**Headline:** Your project archive. On your Drive. Finally findable.  
**Loop:** Capture in-app → AI understands → Vault stores → User retrieves (any device on same cloud)

## Target (90 days)

Primary: architects, interior designers  
Secondary later: engineers, consultants, creative studios

## Architecture — Work Vault (BYOS)

```
Camera / clip / video in Stippo
  → local vault (media + vault.db)
  → AI gateway (transient, no server storage)
  → sync to user cloud folder (Google Drive / OneDrive / local folder)
  → other devices read same vault
```

**Server Stippo holds:** auth, Stripe, AI gateway only.  
**User cloud holds:** full-res media, thumbnails, vault index.

See [`docs/VAULT-PLAN.md`](VAULT-PLAN.md) for phases and sync adapters.

## MVP scope

### In
- Auth (email/password, optional Google)
- In-app camera (primary), clip/snapshot/share, video, voice note
- Local vault (IndexedDB / Capacitor filesystem) + FTS search
- Vision at ingest (every visual asset tagged)
- BYOS sync: Google Drive first; local folder (desktop); OneDrive adapter
- Projects with AI suggestion / auto-link
- Feed, detail, delete
- Free 100 memories / Pro unlimited
- PWA + Capacitor scaffold

### Out
- Full Camera Roll indexing
- Competing with Google Photos visual search on personal photos
- Multi-turn chat assistant
- Heavy DOC/PDF parsing
- Team collaboration (Studio tier later — shared Drive folder)

### Clip tools
- Phone: screenshot → Share → Stippo → crop
- Desktop: paste screenshot → crop
- Video: in-app record → keyframe vision
- Provenance: `sourceUrl`, `sourceTitle`, `clipRectJson`

## Data model (essence)

- **Server:** `User` — plan, Stripe ids/status, memoryCount gate
- **Vault (user cloud):** projects, memories, media bytes, searchText, sync state

Media bytes never persist on Stippo servers.

## Capture patterns

- **Camera in-app** — primary; work photos never land in the birthday album by accident
- Screenshot → Share → Stippo → crop → annotate
- Desktop paste → crop → annotate
- Site video clip → poster + keyframes → vision
- Opt-in GPS / EXIF when present

## AI strategy

1. Client: Web Speech API → transcript
2. Client: thumbnail / video keyframe
3. Server gateway: vision + transcript merge → structured JSON (**no store**)
4. Client: write tags into vault; FTS search (no cloud embeddings)
5. No OpenAI key → mock analyzer (dev/demo)

## Monetization

- Free: 100 memories, vision at ingest, keyword/FTS search, 1 cloud provider
- Pro $15/mo: unlimited, video up to 5 min, batch import, multi-device sync priority
- Studio/Team: later — shared Drive folder for the studio

## Principles

1. Capture in-app → clear destination (work vault)
2. Local-first → offline site visits work
3. One syncable vault folder → media + index travel together
4. User's cloud → cost + privacy + ownership
5. Vision at ingest → “wooden stairs” findable without spoken tags
6. Server without bytes → AI pays for itself via subscription
