"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Search } from "lucide-react";
import { MemoryCard, type MemoryCardData } from "@/components/MemoryCard";

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRec;
    SpeechRecognition?: new () => SpeechRec;
  }
}

export function SearchPanel() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MemoryCardData[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [listening, setListening] = useState(false);
  const [sttSupported, setSttSupported] = useState(true);
  const [sttError, setSttError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRec | null>(null);
  const qRef = useRef(q);
  qRef.current = q;

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSttSupported(Boolean(SR));
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  async function runSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    setBusy(true);
    setSearched(true);
    try {
      const { initVault, searchVault } = await import("@/lib/vault");
      await initVault();
      const hits = await searchVault(trimmed);
      setHits(
        hits.map((h) => ({
          id: h.id,
          title: h.title,
          description: h.description,
          imageUrl: h.thumbnailUrl,
          tags: h.tags,
          projectName: h.projectName,
          createdAt: h.createdAt,
          mediaType: h.mediaType,
          sourceUrl: h.sourceUrl,
          sourceTitle: h.sourceTitle,
        }))
      );
    } catch {
      setHits([]);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (listening && recognitionRef.current) {
      recognitionRef.current.onend = () => setListening(false);
      recognitionRef.current.stop();
      setListening(false);
    }
    await runSearch(q);
  }

  function toggleListen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSttError(
        "Il riconoscimento vocale non è disponibile in questo browser. Scrivi la ricerca."
      );
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    setSttError(null);
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = navigator.language || "it-IT";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let text = "";
      for (let i = 0; i < ev.results.length; i++) {
        text += ev.results[i][0].transcript;
      }
      setQ(text);
    };
    rec.onerror = (ev) => {
      if (ev.error !== "aborted") {
        setSttError(`Errore microfono: ${ev.error}`);
      }
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      const finalQ = qRef.current.trim();
      if (finalQ) void runSearch(finalQ);
    };
    rec.start();
    setListening(true);
  }

  return (
    <div className="vm-section">
      <div>
        <h2 className="vm-page-title">Ask your memory</h2>
        <p className="vm-page-sub">
          Natural language over your project references — hybrid keyword + semantic search.
          {sttSupported ? " Tap the mic to dictate." : null}
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--shadow-sm)]"
      >
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              className="vm-input border-0 bg-transparent pl-10 pr-12 shadow-none focus:border-transparent focus:shadow-none"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder='e.g. "facade ideas with dark frames" or "aluminum windows hotel"'
              aria-label="Search query"
            />
            <button
              type="button"
              onClick={toggleListen}
              disabled={!sttSupported}
              title={
                !sttSupported
                  ? "Speech recognition unavailable"
                  : listening
                    ? "Stop dictation"
                    : "Dictate search"
              }
              aria-pressed={listening}
              aria-label={listening ? "Stop dictation" : "Dictate search"}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 transition ${
                listening
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--ink-muted)] hover:bg-black/5 hover:text-[var(--ink)]"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          </div>
          <button className="vm-btn-primary shrink-0 !px-5" disabled={busy}>
            {busy ? "…" : "Search"}
          </button>
        </div>
      </form>

      {listening ? (
        <p className="text-sm font-medium text-[var(--accent)]">Listening… speak your search</p>
      ) : null}
      {sttError ? <p className="text-sm text-[var(--danger)]">{sttError}</p> : null}

      {searched ? (
        <p className="text-sm text-[var(--ink-muted)]">
          {hits.length} reference{hits.length === 1 ? "" : "s"} found
        </p>
      ) : null}

      {!searched && !listening ? (
        <div className="vm-empty py-8">
          <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
            Try materials, details, or places — e.g. “oak flooring lobby” or “steel staircase Milan”.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {hits.map((m) => (
          <MemoryCard key={m.id} memory={m} />
        ))}
      </div>
    </div>
  );
}
