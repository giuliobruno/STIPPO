"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  ClipboardPaste,
  Crop,
  Images,
  MapPin,
  Mic,
  MicOff,
  X,
} from "lucide-react";
import { createThumbnail } from "@/lib/media/thumbnail";
import { cropImageFile, type CropRect } from "@/lib/media/crop";
import {
  CLIP_MESSAGE_TYPE,
  dataUrlToFile,
  takePendingClip,
  type PendingClip,
} from "@/lib/media/clip-bridge";
import {
  approximatePlaceLabel,
  readDeviceGps,
  readExifGps,
  type GeoPoint,
} from "@/lib/media/geo";
import { CropEditor } from "@/components/CropEditor";

type Project = { id: string; name: string };

type CaptureSource =
  | "camera"
  | "upload"
  | "paste"
  | "voice"
  | "share"
  | "screenshot"
  | "extension";

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
  const openCropAfterLoadRef = useRef(false);

  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [source, setSource] = useState<CaptureSource>("upload");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sttSupported, setSttSupported] = useState(true);
  const [attachGps, setAttachGps] = useState(true);
  const [geo, setGeo] = useState<GeoPoint | null>(null);
  const [syncOriginal, setSyncOriginal] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [clipRect, setClipRect] = useState<CropRect | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const recognitionRef = useRef<SpeechRec | null>(null);
  const attachGpsRef = useRef(attachGps);
  attachGpsRef.current = attachGps;

  const startCrop = useCallback(() => {
    if (file && file.type.startsWith("image/") && preview) {
      setCropping(true);
      setError(null);
    }
  }, [file, preview]);

  const setImageFile = useCallback(
    async (
      f: File,
      src: CaptureSource,
      opts?: { keepClipRect?: boolean; openCrop?: boolean }
    ) => {
      setFile(f);
      setSource(src);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(f);
      });
      if (!opts?.keepClipRect) setClipRect(null);
      setError(null);

      const fromFlag = openCropAfterLoadRef.current;
      openCropAfterLoadRef.current = false;
      const shouldOpenCrop =
        f.type.startsWith("image/") &&
        !opts?.keepClipRect &&
        (Boolean(opts?.openCrop) ||
          fromFlag ||
          // Screens grabbed from other apps → go straight to crop.
          src === "paste" ||
          src === "screenshot" ||
          src === "share");
      if (shouldOpenCrop) setCropping(true);

      const exif = await readExifGps(f);
      if (exif) {
        setGeo({
          ...exif,
          placeName: approximatePlaceLabel(exif.latitude, exif.longitude),
        });
        return;
      }
      if (attachGpsRef.current) {
        const device = await readDeviceGps();
        if (device) {
          setGeo({
            ...device,
            placeName: approximatePlaceLabel(device.latitude, device.longitude),
          });
        }
      }
    },
    []
  );

  const ingestPendingClip = useCallback(
    async (clip: PendingClip) => {
      try {
        const f = dataUrlToFile(clip.dataUrl, `clip-${Date.now()}.png`);
        const src: CaptureSource =
          clip.source === "share" || clip.source === "screenshot"
            ? clip.source
            : "extension";
        // Extension already cropped; share/screenshot usually need the crop UI.
        const openCrop =
          Boolean(clip.openCrop) || (!clip.clipRect && src !== "extension");
        await setImageFile(f, src, { openCrop, keepClipRect: Boolean(clip.clipRect) });
        if (clip.sourceUrl) setSourceUrl(clip.sourceUrl);
        if (clip.sourceTitle) setSourceTitle(clip.sourceTitle);
        if (clip.note) setTranscript((t) => t || clip.note || "");
        if (clip.clipRect) setClipRect(clip.clipRect);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load clip");
      }
    },
    [setImageFile]
  );

  // Deep link / share: /app/capture?note=...&source=share
  useEffect(() => {
    const note =
      searchParams.get("note") ||
      searchParams.get("transcript") ||
      searchParams.get("text");
    const src = searchParams.get("source");
    const url =
      searchParams.get("sourceUrl") || searchParams.get("url") || "";
    const title =
      searchParams.get("sourceTitle") || searchParams.get("title") || "";
    if (note) setTranscript(note);
    if (
      src === "share" ||
      src === "screenshot" ||
      src === "extension" ||
      src === "paste" ||
      src === "camera" ||
      src === "upload"
    ) {
      setSource(src);
    } else if (url || searchParams.get("text")) {
      setSource("share");
    }
    if (url) setSourceUrl(url);
    if (title) setSourceTitle(title);
  }, [searchParams]);

  // Share-target / pending-image bridge (postMessage + IndexedDB)
  useEffect(() => {
    let cancelled = false;

    void takePendingClip().then((clip) => {
      if (!cancelled && clip?.dataUrl) void ingestPendingClip(clip);
    });

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.type !== CLIP_MESSAGE_TYPE || !data.dataUrl) return;
      void ingestPendingClip({
        dataUrl: data.dataUrl,
        sourceUrl: data.sourceUrl,
        sourceTitle: data.sourceTitle,
        note: data.note,
        clipRect: data.clipRect,
        openCrop: data.openCrop,
        source: data.source,
      });
    };
    window.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
    };
  }, [ingestPendingClip]);

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

  async function applyCrop(rect: Omit<CropRect, "imageWidth" | "imageHeight">) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { file: cropped, rect: fullRect } = await cropImageFile(file, rect);
      await setImageFile(cropped, source === "extension" ? "extension" : source, {
        keepClipRect: true,
      });
      setClipRect(fullRect);
      setCropping(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Crop failed");
    } finally {
      setBusy(false);
    }
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
      if (sourceUrl.trim()) body.append("sourceUrl", sourceUrl.trim());
      if (sourceTitle.trim()) body.append("sourceTitle", sourceTitle.trim());
      if (clipRect) body.append("clipRect", JSON.stringify(clipRect));

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
    <>
      {cropping && preview ? (
        <CropEditor
          imageUrl={preview}
          onCancel={() => setCropping(false)}
          onApply={(rect) => void applyCrop(rect)}
        />
      ) : null}

      <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-6">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-[family-name:var(--font-serif)] text-3xl">
              Capture memory
            </h2>
            <p className="text-sm text-[var(--ink-muted)]">
              Pick a photo from your album, add a note on the fly, save.
            </p>
          </div>
          <Link
            href="/app/guide"
            className="shrink-0 text-xs font-medium text-[var(--accent)]"
          >
            Guide
          </Link>
        </div>

        <div className="vm-card p-4">
          {preview ? (
            <div className="relative overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Preview" className="max-h-80 w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/65 to-transparent p-3 pt-10">
                <button
                  type="button"
                  className="vm-btn-primary !bg-white !text-[var(--ink)]"
                  onClick={startCrop}
                >
                  <Crop className="h-4 w-4" />
                  Crop
                </button>
                <button
                  type="button"
                  className="rounded-full bg-black/50 p-2 text-white"
                  aria-label="Remove image"
                  onClick={() => {
                    if (preview) URL.revokeObjectURL(preview);
                    setPreview(null);
                    setFile(null);
                    setGeo(null);
                    setClipRect(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--line)] bg-[var(--paper)] px-6 text-center transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              <Images className="h-8 w-8 text-[var(--accent)]" />
              <div>
                <p className="font-[family-name:var(--font-serif)] text-xl">
                  Choose from album
                </p>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  Any photo — then speak or type a note below
                </p>
              </div>
            </button>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              className="vm-btn-secondary"
              onClick={() => fileRef.current?.click()}
            >
              <Images className="h-4 w-4" />
              Album
            </button>
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
              onClick={() =>
                setError("On desktop: paste a screenshot with Ctrl/Cmd+V.")
              }
            >
              <ClipboardPaste className="h-4 w-4" />
              Paste
            </button>
          </div>
          {file?.type.startsWith("image/") ? (
            <button
              type="button"
              className="vm-btn-secondary mt-2 w-full"
              onClick={startCrop}
            >
              <Crop className="h-4 w-4" />
              Crop detail (optional)
            </button>
          ) : null}
          {clipRect ? (
            <p className="mt-2 text-xs text-[var(--ink-muted)]">
              Cropped {Math.round(clipRect.width)}×{Math.round(clipRect.height)} from{" "}
              {clipRect.imageWidth}×{clipRect.imageHeight}
            </p>
          ) : null}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void setImageFile(f, "camera");
              e.target.value = "";
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void setImageFile(f, "upload");
              e.target.value = "";
            }}
          />
        </div>

        {(sourceUrl || source === "extension" || source === "share") && (
          <div className="vm-card space-y-3 p-4">
            <p className="vm-label mb-0">Source page</p>
            <input
              className="vm-input"
              placeholder="Page title"
              value={sourceTitle}
              onChange={(e) => setSourceTitle(e.target.value)}
            />
            <input
              className="vm-input"
              placeholder="https://…"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>
        )}

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
    </>
  );
}
