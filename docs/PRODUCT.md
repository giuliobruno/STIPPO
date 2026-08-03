# Visual Memory — Product & Engineering Spec (MVP)

## Positioning

**Not:** generic AI second brain / MyMind clone  
**Is:** project visual memory for architects & interior designers

**Headline:** Your project references, finally findable.  
**Loop:** Capture → AI understands → AI organizes → User retrieves

## Target (90 days)

Primary: architects, interior designers  
Secondary later: engineers, consultants, creative studios

## MVP scope

### In
- Auth (email/password, optional Google)
- Capture image (camera/upload/paste) + voice note (native STT)
- Memory object with AI title/tags/entities/summary
- Projects with AI suggestion / auto-link
- Feed, detail, delete
- Hybrid semantic + keyword search
- Local-first storage abstraction
- Free 100 memories / Pro unlimited (gate only; Stripe later)
- PWA install manifest

### Out
- Team collaboration
- Multi-turn chat assistant
- Heavy DOC/PDF parsing
- Timeline UI
- ElevenLabs / premium TTS
- Full Camera Roll indexing (needs native wrapper)

### Clip tools
- Phone: screenshot → Share → Stippo (PWA `share_target`) → in-app crop
- Desktop: paste screenshot → in-app crop
- Memory provenance: `sourceUrl`, `sourceTitle`, `clipRectJson`

## Data model (essence)

- `User` — plan, Stripe ids/status, memoryCount
- `Project` — name, location, client
- `Memory` — media keys, transcript, AI fields, embedding, geo (lat/lng/placeName), syncStatus

Media bytes ≠ database. DB stores understanding + pointers + optional GPS.

## Hybrid Plan B

1. Always: thumbnail + semantic index (cross-device findable)
2. Default: full-res stays on capturing device
3. Pro opt-in: `originalSyncEnabled` uploads full-res

## Capture patterns

- Screenshot → Share → Stippo (phone PWA) → crop detail → annotate
- Screenshot paste (desktop) → crop → annotate: “scala ferro e vetro progetto Milano”
- Site photo → EXIF GPS when present
- Opt-in device GPS at save time
- Screenshots usually lack EXIF → spoken place or GPS toggle

## AI strategy

1. Client: Web Speech API → transcript
2. Client: thumbnail + EXIF/GPS
3. Server: vision + transcript merge → structured JSON + embed
4. No OpenAI key → mock analyzer (dev/demo)

## Monetization

- Free: 100 memories, hybrid index
- Pro $15/mo: unlimited + full-res sync opt-in
- Studio/Team: later (shared project library)