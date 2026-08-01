"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Camera,
  ClipboardPaste,
  MapPin,
  Mic,
  MicOff,
  Upload,
  X,
} from "lucide-react";
import { createThumbnail } from "@/lib/media/thumbnail";
import {
  approximatePlaceLabel,
  readDeviceGps,
  readExifGps,
  type GeoPoint,
} from "@/lib/media/geo";

type Project = { id: string; name: string };

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

export function CaptureForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [source, setSource] = useState<
    "camera" | "upload" | "paste" | "voice" | "share" | "screenshot"
  >("upload");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sttSupported, setSttSupported] = useState(true);
  const [attachGps, setAttachGps] = useState(true);
  const [geo, setGeo] = useState<GeoPoint | null>(null);
  const [syncOriginal, setSyncOriginal] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const recognitionRef = useRef<SpeechRec | null>(null);

  // Deep link / share target: /app/capture?note=...&source=share
  useEffect(() => {
    const note = searchParams.get("note") || searchParams.get("transcript");
    const src = searchParams.get("source");
    if (note) setTranscript(note);
    if (src === "share" || src === "screenshot") {
      setSource(src);
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => undefined);

    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((d) => setIsPro(Boolean(d.pro)))
      .catch(() => undefined);

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSttSupported(Boolean(SR));
  }, []);

  const setImageFile = useCallback(
    async (f: File, src: typeof source) => {
      setFile(f);
      setSource(src);
      setPreview(URL.createObjectURL(f));
      setError(null);

      // Prefer EXIF GPS from site photos; fall back to device GPS if enabled
      const exif = await readExifGps(f);
      if (exif) {
        setGeo({
          ...exif,
          placeName: approximatePlaceLabel(exif.latitude, exif.longitude),
        });
        return;
      }
      if (attachGps) {
        const device = await readDeviceGps();
        if (device) {
          setGeo({
            ...device,
            placeName: approximatePlaceLabel(device.latitude, device.longitude),
          });
        }
      }
    },
    [attachGps]
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            void setImageFile(
              new File([blob], `screenshot-${Date.now()}.png`, { type: blob.type }),
              "screenshot"
            );
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [setImageFile]);

  async function refreshGps() {
    const device = await readDeviceGps();
    if (!device) {
      setError("Location permission denied or unavailable.");
      return;
    }
    setGeo({
      ...device,
      placeName: approximatePlaceLabel(device.latitude, device.longitude),
    });
  }

  function toggleListen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError(
        "Native speech recognition is not available in this browser. Type the note instead."
      );
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let text = "";
      for (let i = 0; i < ev.results.length; i++) {
        text += ev.results[i][0].transcript;
      }
      setTranscript(text);
    };
    rec.onerror = (ev) => {
      setError(`Speech error: ${ev.error}`);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
    if (!file) setSource("voice");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file && !transcript.trim()) {
      setError("Add a photo/screenshot or speak a note.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      if (file) {
        body.append("file", file);
        if (file.type.startsWith("image/")) {
          const thumb = await createThumbnail(file);
          body.append(
            "thumbnail",
            new File([thumb], "thumb.jpg", { type: "image/jpeg" })
          );
        }
      }
      if (transcript.trim()) body.append("transcript", transcript.trim());
      body.append("source", source);
      if (projectId) body.append("projectId", projectId);
      if (!file && transcript.trim()) body.append("voiceOnly", "true");
      if (syncOriginal) body.append("syncOriginal", "true");

      if (attachGps && geo) {
        body.append("latitude", String(geo.latitude));
        body.append("longitude", String(geo.longitude));
        body.append("locationSource", geo.locationSource);
        if (geo.placeName) body.append("placeName", geo.placeName);
      }

      const res = await fetch("/api/memories", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Capture failed");
      router.push(`/app/memories/${data.memory.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <h2 className="font-[family-name:var(--font-serif)] text-3xl">
          Capture memory
        </h2>
        <p className="text-sm text-[var(--ink-muted)]">
          Paste a screenshot, speak the thought — e.g. “scala interessante ferro e
          vetro progetto Milano”. Thumbnail + understanding sync; originals stay local.
        </p>
      </div>

      <div className="vm-card p-4">
        {preview ? (
          <div className="relative overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Preview" className="max-h-80 w-full object-cover" />
            <button
              type="button"
              className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white"
              onClick={() => {
                setPreview(null);
                setFile(null);
                setGeo(null);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-[var(--paper)] px-6 text-center">
            <p className="font-[family-name:var(--font-serif)] text-xl">
              Screenshot or site photo
            </p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Camera · upload · paste (Ctrl/Cmd+V) · share target
            </p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            className="vm-btn-secondary"
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
            Camera
          </button>
          <button
            type="button"
            className="vm-btn-secondary"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>
          <button
            type="button"
            className="vm-btn-secondary"
            onClick={() =>
              setError("Paste a screenshot anywhere on this page (Ctrl/Cmd+V).")
            }
          >
            <ClipboardPaste className="h-4 w-4" />
            Paste
          </button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void setImageFile(f, "camera");
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void setImageFile(f, "upload");
          }}
        />
      </div>

      <div className="vm-card space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="vm-label mb-0">Annotate on the fly</p>
            <p className="text-xs text-[var(--ink-muted)]">
              Native STT {sttSupported ? "ready" : "unavailable — type instead"}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleListen}
            className={listening ? "vm-btn-primary" : "vm-btn-secondary"}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {listening ? "Stop" : "Speak"}
          </button>
        </div>
        <textarea
          className="vm-input min-h-28 resize-y"
          placeholder='e.g. "scala interessante ferro e vetro progetto Milano"'
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
        />
      </div>

      <div className="vm-card space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="vm-label mb-0">Location</p>
            <p className="text-xs text-[var(--ink-muted)]">
              EXIF from site photos, or GPS when you save (opt-in). Screenshots rarely have EXIF.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={attachGps}
              onChange={(e) => setAttachGps(e.target.checked)}
            />
            Attach
          </label>
        </div>
        {geo ? (
          <p className="flex items-center gap-2 text-sm text-[var(--accent)]">
            <MapPin className="h-4 w-4 shrink-0" />
            {geo.placeName} · via {geo.locationSource}
          </p>
        ) : (
          <button type="button" className="vm-btn-secondary" onClick={() => void refreshGps()}>
            <MapPin className="h-4 w-4" />
            Use current GPS
          </button>
        )}
      </div>

      <div>
        <label className="vm-label" htmlFor="project">
          Project (optional)
        </label>
        <select
          id="project"
          className="vm-input"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">Auto-detect from voice</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-start gap-3 text-sm text-[var(--ink-muted)]">
        <input
          type="checkbox"
          className="mt-1"
          checked={syncOriginal}
          disabled={!isPro}
          onChange={(e) => setSyncOriginal(e.target.checked)}
        />
        <span>
          Sync full-resolution original to cloud (Pro)
          {!isPro ? " — upgrade in Billing" : " — otherwise only thumbnail + index sync"}
        </span>
      </label>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={busy} className="vm-btn-primary w-full !py-3.5">
        {busy ? "Understanding…" : "Save memory"}
      </button>
    </form>
  );
}
