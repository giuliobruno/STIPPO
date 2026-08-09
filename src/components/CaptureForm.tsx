"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  ClipboardPaste,
  Crop,
  FileText,
  Images,
  Link2,
  MapPin,
  Mic,
  MicOff,
  Video,
  X,
} from "lucide-react";
import { extractUrl, normalizeHttpUrl } from "@/lib/media/url";
import {
  DOCUMENT_ACCEPT,
  formatBytes,
  isDocumentFile,
  isPdfFile,
  validateDocumentFile,
} from "@/lib/media/files";
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
import {
  analyzeViaGateway,
  applyAnalysis,
  assertVaultCanCreate,
  createVaultMemory,
  initVault,
  listVaultProjects,
  markMemoryFailed,
  upsertVaultProject,
} from "@/lib/vault";
import { createVideoPoster, extractVideoKeyframes } from "@/lib/vault/video";
import { processSyncQueue } from "@/lib/vault/sync";
import type { VaultMediaType, VaultSource } from "@/lib/vault/types";
import { FREE_VIDEO_MAX_MS, PRO_VIDEO_MAX_MS } from "@/lib/vault/types";
import { fill, speechLocale, useLocale, useT } from "@/i18n";

type Project = { id: string; name: string };

type CaptureSource =
  | "camera"
  | "upload"
  | "paste"
  | "voice"
  | "share"
  | "screenshot"
  | "extension"
  | "clip"
  | "snapshot"
  | "import";

type CommandHint = "photo" | "video" | "import" | "paste" | "link";

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
  const { locale } = useLocale();
  const t = useT();
  const c = t.capture;
  const commandHints: Record<CommandHint, string> = {
    photo: c.hintPhoto,
    video: c.hintVideo,
    import: c.hintImport,
    paste: c.hintPaste,
    link: c.hintLink,
  };
  const linkUrlInputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const openCropAfterLoadRef = useRef(false);

  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [source, setSource] = useState<CaptureSource>("camera");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sttSupported, setSttSupported] = useState(true);
  const [attachGps, setAttachGps] = useState(true);
  const [geo, setGeo] = useState<GeoPoint | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [clipRect, setClipRect] = useState<CropRect | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [commandHint, setCommandHint] = useState<CommandHint | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [projectListening, setProjectListening] = useState(false);
  const [projectBusy, setProjectBusy] = useState(false);
  const recognitionRef = useRef<SpeechRec | null>(null);
  const projectRecognitionRef = useRef<SpeechRec | null>(null);
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
        const mimeHint = clip.dataUrl.slice(0, 40);
        const isVideo = mimeHint.includes("video/");
        const f = dataUrlToFile(
          clip.dataUrl,
          isVideo ? `clip-${Date.now()}.mp4` : `clip-${Date.now()}.png`
        );
        if (isVideo) {
          setFile(f);
          setSource("share");
          setPreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(f);
          });
          if (clip.sourceUrl) setSourceUrl(clip.sourceUrl);
          if (clip.sourceTitle) setSourceTitle(clip.sourceTitle);
          if (clip.note) setTranscript((t) => t || clip.note || "");
          return;
        }
        const src: CaptureSource =
          clip.source === "share" || clip.source === "screenshot"
            ? clip.source
            : "extension";
        const openCrop =
          Boolean(clip.openCrop) || (!clip.clipRect && src !== "extension");
        await setImageFile(f, src, { openCrop, keepClipRect: Boolean(clip.clipRect) });
        if (clip.sourceUrl) setSourceUrl(clip.sourceUrl);
        if (clip.sourceTitle) setSourceTitle(clip.sourceTitle);
        if (clip.note) setTranscript((t) => t || clip.note || "");
        if (clip.clipRect) setClipRect(clip.clipRect);
      } catch (err) {
        setError(err instanceof Error ? err.message : c.errLoadClip);
      }
    },
    [setImageFile, c.errLoadClip]
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
    void initVault().then(() =>
      listVaultProjects().then((ps) =>
        setProjects(ps.map((p) => ({ id: p.id, name: p.name })))
      )
    );

    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((d) => setIsPro(Boolean(d.pro)))
      .catch(() => undefined);

    // Seed projects from server if vault empty (migration bridge)
    fetch("/api/projects")
      .then((r) => r.json())
      .then(async (d) => {
        const serverProjects = (d.projects || []) as Project[];
        if (!serverProjects.length) return;
        const local = await listVaultProjects();
        if (local.length) return;
        for (const p of serverProjects) {
          await upsertVaultProject({
            id: p.id,
            name: p.name,
            description: null,
            location: null,
            clientName: null,
          });
        }
        setProjects(serverProjects);
      })
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
            return;
          }
        }
      }
      const text = e.clipboardData?.getData("text/plain") || "";
      const url = extractUrl(text);
      if (url && !file) {
        setSourceUrl(url);
        setSource((prev) => (prev === "camera" ? "paste" : prev));
        setCommandHint("link");
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [setImageFile, file]);

  async function refreshGps() {
    const device = await readDeviceGps();
    if (!device) {
      setError(c.errGps);
      return;
    }
    setGeo({
      ...device,
      placeName: approximatePlaceLabel(device.latitude, device.longitude),
    });
  }

  async function pasteFromClipboard() {
    setCommandHint("paste");
    setError(null);
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((type) => type.startsWith("image/"));
          if (!imageType) continue;
          const blob = await item.getType(imageType);
          await setImageFile(
            new File([blob], `screenshot-${Date.now()}.png`, {
              type: imageType,
            }),
            "screenshot"
          );
          return;
        }
        for (const item of items) {
          if (!item.types.includes("text/plain")) continue;
          const blob = await item.getType("text/plain");
          const text = await blob.text();
          const url = extractUrl(text);
          if (url) {
            setSourceUrl(url);
            setSource((prev) => (prev === "camera" ? "paste" : prev));
            setCommandHint("link");
            return;
          }
        }
        setError(c.errClipboardEmpty);
        return;
      }
      const text = await navigator.clipboard?.readText?.();
      const url = extractUrl(text || "");
      if (url) {
        setSourceUrl(url);
        setSource((prev) => (prev === "camera" ? "paste" : prev));
        setCommandHint("link");
        return;
      }
    } catch {
      // Browser may block Clipboard API — Ctrl/Cmd+V still works via paste listener.
    }
    setError(c.errPasteFallback);
  }

  function focusLinkField() {
    setCommandHint("link");
    setError(null);
    linkUrlInputRef.current?.focus();
    linkUrlInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function createProjectInline() {
    const name = newProjectName.trim();
    if (!name) {
      setError(c.errProjectName);
      return;
    }
    setProjectBusy(true);
    setError(null);
    try {
      const project = await upsertVaultProject({
        name,
        description: null,
        location: null,
        clientName: null,
      });
      void fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).catch(() => undefined);
      setProjects((prev) =>
        prev.some((p) => p.id === project.id)
          ? prev
          : [...prev, { id: project.id, name: project.name }]
      );
      setProjectId(project.id);
      setNewProjectName("");
      setCreatingProject(false);
      if (projectListening && projectRecognitionRef.current) {
        projectRecognitionRef.current.stop();
        setProjectListening(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : c.errCreateProject);
    } finally {
      setProjectBusy(false);
    }
  }

  function toggleProjectListen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError(c.errSpeechProject);
      return;
    }

    if (projectListening && projectRecognitionRef.current) {
      projectRecognitionRef.current.stop();
      setProjectListening(false);
      return;
    }

    // Stop annotate mic so only one recognition session runs.
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
    }

    const rec = new SR();
    projectRecognitionRef.current = rec;
    rec.lang = speechLocale[locale];
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let text = "";
      for (let i = 0; i < ev.results.length; i++) {
        text += ev.results[i][0].transcript;
      }
      setNewProjectName(text.trim());
    };
    rec.onerror = (ev) => {
      setError(fill(c.errSpeech, { error: ev.error }));
      setProjectListening(false);
    };
    rec.onend = () => setProjectListening(false);
    rec.start();
    setProjectListening(true);
    setCreatingProject(true);
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
      setError(err instanceof Error ? err.message : c.errCrop);
    } finally {
      setBusy(false);
    }
  }

  function toggleListen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError(c.errSpeechNote);
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    if (projectListening && projectRecognitionRef.current) {
      projectRecognitionRef.current.stop();
      setProjectListening(false);
    }

    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = speechLocale[locale];
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
      setError(fill(c.errSpeech, { error: ev.error }));
      setListening(false);
    };
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
    if (!file) setSource("voice");
  }

  function resolveMediaType(
    f: File | null,
    src: CaptureSource,
    link: string | null
  ): VaultMediaType {
    if (!f) return link ? "link" : "audio";
    if (f.type.startsWith("video/")) return "video";
    if (isDocumentFile(f)) return "document";
    if (src === "clip" || clipRect) return "clip";
    if (src === "screenshot" || src === "share" || src === "paste") return "snapshot";
    return "image";
  }

  function setDocumentFile(f: File) {
    const issue = validateDocumentFile(f);
    if (issue === "too_large") {
      setError(c.errFileTooLarge);
      return;
    }
    if (issue) {
      setError(c.errFileUnsupported);
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(f);
    setSource("import");
    setClipRect(null);
    setError(null);
    if (!sourceTitle.trim()) {
      setSourceTitle(f.name.replace(/\.[^.]+$/, "") || f.name);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const link =
      normalizeHttpUrl(sourceUrl.trim()) || extractUrl(sourceUrl.trim());
    if (!file && !transcript.trim() && !link) {
      setError(c.errNeedMedia);
      return;
    }
    if (sourceUrl.trim() && !link) {
      setError(c.errInvalidUrl);
      return;
    }
    const willBeDocument = file ? isDocumentFile(file) : false;
    if (willBeDocument && !transcript.trim() && !isPdfFile(file!)) {
      setError(c.errNeedNoteForFile);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await assertVaultCanCreate(isPro);

      const mediaType = resolveMediaType(file, source, link);
      const vaultSource = (source === "upload" ? "import" : source) as VaultSource;

      let thumb: Blob | null = null;
      let frames: Blob[] = [];
      let durationMs: number | null = null;
      let width: number | null = null;
      let height: number | null = null;

      if (file?.type.startsWith("image/")) {
        thumb = await createThumbnail(file);
      } else if (file?.type.startsWith("video/")) {
        const maxMs = isPro ? PRO_VIDEO_MAX_MS : FREE_VIDEO_MAX_MS;
        const extracted = await extractVideoKeyframes(file, isPro ? 3 : 1);
        durationMs = extracted.durationMs;
        width = extracted.width;
        height = extracted.height;
        if (durationMs > maxMs) {
          throw new Error(isPro ? c.errVideoPro : c.errVideoFree);
        }
        frames = extracted.frames;
        thumb = frames[0] || (await createVideoPoster(file));
      }

      const memory = await createVaultMemory({
        mediaType,
        source: vaultSource,
        file: file || null,
        fileName: file?.name,
        mimeType:
          file?.type ||
          (mediaType === "link"
            ? "text/uri-list"
            : mediaType === "document"
              ? "application/octet-stream"
              : undefined),
        thumb,
        frames: frames.length ? frames : undefined,
        transcript: transcript.trim() || undefined,
        projectId: projectId || null,
        sourceUrl: link || sourceUrl.trim() || null,
        sourceTitle:
          sourceTitle.trim() ||
          (mediaType === "document" && file ? file.name : null),
        clipRect: clipRect || null,
        latitude: attachGps && geo ? geo.latitude : null,
        longitude: attachGps && geo ? geo.longitude : null,
        placeName: attachGps && geo?.placeName ? geo.placeName : null,
        locationSource: attachGps && geo ? geo.locationSource : null,
        durationMs,
        width,
        height,
      });

      // Vision at ingest — image/poster; links → URL; documents → note (+ PDF light)
      const visionBlob =
        file?.type.startsWith("image/")
          ? file
          : file?.type.startsWith("video/")
            ? frames[0] || thumb
            : null;

      try {
        const baseOpts = {
          imageBlob: visionBlob,
          mimeType:
            mediaType === "document"
              ? file?.type || "application/octet-stream"
              : visionBlob?.type || "image/jpeg",
          transcript: transcript.trim() || undefined,
          url: mediaType === "link" ? link : null,
          fileName: mediaType === "document" ? file?.name || null : null,
          projectHints: projects.map((p) => p.name),
        };
        let analysis;
        try {
          analysis = await analyzeViaGateway({
            ...baseOpts,
            documentBlob:
              mediaType === "document" && file && isPdfFile(file) ? file : null,
          });
        } catch (firstAiErr) {
          // Large PDF / extract failure — retry with note + filename only
          if (mediaType === "document" && file && isPdfFile(file)) {
            analysis = await analyzeViaGateway({
              ...baseOpts,
              documentBlob: null,
            });
          } else {
            throw firstAiErr;
          }
        }
        await applyAnalysis(memory.id, analysis, {
          projectId: projectId || null,
        });
      } catch (aiErr) {
        await markMemoryFailed(
          memory.id,
          aiErr instanceof Error ? aiErr.message : "AI failed"
        );
      }

      // Background sync to user cloud (non-blocking)
      void processSyncQueue().catch(() => undefined);

      router.push(`/app/memories/${memory.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : c.errCapture);
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
          <div>
            <h2 className="vm-page-title">{c.title}</h2>
            <p className="vm-page-sub">{c.subtitle}</p>
          </div>
          <Link
            href="/app/guide"
            className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] transition hover:border-[var(--accent)]/30"
          >
            {c.guide}
          </Link>
        </div>

        <div className="overflow-hidden rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)] sm:p-4">
          {preview ? (
            <div className="relative overflow-hidden rounded-xl">
              {file?.type.startsWith("video/") ? (
                <video
                  src={preview}
                  controls
                  className="max-h-80 w-full object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Preview" className="max-h-80 w-full object-cover" />
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/65 to-transparent p-3 pt-10">
                {file?.type.startsWith("image/") ? (
                  <button
                    type="button"
                    className="vm-btn-primary !bg-white !text-[var(--ink)]"
                    onClick={startCrop}
                  >
                    <Crop className="h-4 w-4" />
                    {c.crop}
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  className="rounded-full bg-black/50 p-2 text-white backdrop-blur-sm"
                  aria-label={c.removeMedia}
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
          ) : file && isDocumentFile(file) ? (
            <div className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-xl border border-[var(--line)] bg-[linear-gradient(155deg,var(--paper)_0%,var(--accent-soft)_55%,var(--paper-2)_100%)] px-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--accent)] shadow-sm">
                <FileText className="h-7 w-7" />
              </span>
              <div className="min-w-0 max-w-full">
                <p className="truncate font-[family-name:var(--font-serif)] text-xl tracking-tight">
                  {file.name}
                </p>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  {formatBytes(file.size)}
                  {file.type ? ` · ${file.type}` : ""}
                </p>
                <p className="mt-2 text-xs text-[var(--ink-muted)]">{c.documentHint}</p>
              </div>
              <button
                type="button"
                className="absolute right-3 top-3 rounded-full bg-black/45 p-2 text-white backdrop-blur-sm"
                aria-label={c.removeMedia}
                onClick={() => {
                  setFile(null);
                  setError(null);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="group flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--line)] bg-[linear-gradient(160deg,var(--paper)_0%,var(--accent-soft)_100%)] px-6 text-center transition hover:border-[var(--accent)]"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_8px_20px_rgba(26,51,84,0.25)] transition group-hover:scale-105">
                <Camera className="h-6 w-6" />
              </span>
              <div>
                <p className="font-[family-name:var(--font-serif)] text-xl tracking-tight">
                  {c.openCameraTitle}
                </p>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  {c.openCameraHint}
                </p>
              </div>
            </button>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            <button
              type="button"
              className="vm-command-primary"
              title={commandHints.photo}
              aria-label={`${c.photo} — ${commandHints.photo}`}
              onFocus={() => setCommandHint("photo")}
              onMouseEnter={() => setCommandHint("photo")}
              onClick={() => {
                setCommandHint("photo");
                cameraRef.current?.click();
              }}
            >
              <Camera className="h-4 w-4" />
              {c.photo}
            </button>
            <button
              type="button"
              className="vm-command"
              title={commandHints.video}
              aria-label={`${c.video} — ${commandHints.video}`}
              onFocus={() => setCommandHint("video")}
              onMouseEnter={() => setCommandHint("video")}
              onClick={() => {
                setCommandHint("video");
                videoRef.current?.click();
              }}
            >
              <Video className="h-4 w-4" />
              {c.video}
            </button>
            <button
              type="button"
              className="vm-command"
              title={commandHints.import}
              aria-label={`${c.import} — ${commandHints.import}`}
              onFocus={() => setCommandHint("import")}
              onMouseEnter={() => setCommandHint("import")}
              onClick={() => {
                setCommandHint("import");
                fileRef.current?.click();
              }}
            >
              <Images className="h-4 w-4" />
              {c.import}
            </button>
            <button
              type="button"
              className="vm-command"
              title={commandHints.paste}
              aria-label={`${c.paste} — ${commandHints.paste}`}
              onFocus={() => setCommandHint("paste")}
              onMouseEnter={() => setCommandHint("paste")}
              onClick={() => void pasteFromClipboard()}
            >
              <ClipboardPaste className="h-4 w-4" />
              {c.paste}
            </button>
            <button
              type="button"
              className="vm-command col-span-3 sm:col-span-1"
              title={commandHints.link}
              aria-label={`${c.link} — ${commandHints.link}`}
              onFocus={() => setCommandHint("link")}
              onMouseEnter={() => setCommandHint("link")}
              onClick={focusLinkField}
            >
              <Link2 className="h-4 w-4" />
              {c.link}
            </button>
          </div>
          <p className="mt-2.5 min-h-[2.5rem] text-xs leading-snug text-[var(--ink-muted)]">
            {commandHint ? commandHints[commandHint] : c.hintIdle}
          </p>
          {clipRect ? (
            <p className="mt-2 text-xs text-[var(--ink-muted)]">
              {fill(c.croppedFrom, {
                w: Math.round(clipRect.width),
                h: Math.round(clipRect.height),
                iw: clipRect.imageWidth,
                ih: clipRect.imageHeight,
              })}
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
            ref={videoRef}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                setSource("camera");
                setPreview((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return URL.createObjectURL(f);
                });
                setClipRect(null);
                setError(null);
              }
              e.target.value = "";
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept={`image/*,video/*,${DOCUMENT_ACCEPT}`}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (f.type.startsWith("video/")) {
                  setFile(f);
                  setSource("import");
                  setPreview((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return URL.createObjectURL(f);
                  });
                  setClipRect(null);
                  setError(null);
                } else if (f.type.startsWith("image/")) {
                  void setImageFile(f, "import");
                } else {
                  setDocumentFile(f);
                }
              }
              e.target.value = "";
            }}
          />
        </div>

        <div className="space-y-3 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <div>
            <p className="vm-label mb-0">{c.sourcePage}</p>
            <p className="text-xs text-[var(--ink-muted)]">{c.linkHint}</p>
          </div>
          <input
            ref={linkUrlInputRef}
            className="vm-input"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://…"
            value={sourceUrl}
            onChange={(e) => {
              setSourceUrl(e.target.value);
              if (e.target.value.trim()) setCommandHint("link");
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text/plain");
              const url = extractUrl(text);
              if (url && text.trim() !== url) {
                e.preventDefault();
                setSourceUrl(url);
              }
            }}
          />
          <input
            className="vm-input"
            placeholder={c.pageTitle}
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
          />
        </div>

        <div className="space-y-3 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="vm-label mb-0">{c.annotate}</p>
              <p className="text-xs text-[var(--ink-muted)]">
                {sttSupported ? c.sttReady : c.sttUnavailable}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleListen}
              className={listening ? "vm-btn-primary" : "vm-btn-secondary"}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {listening ? c.stop : c.speak}
            </button>
          </div>
          <textarea
            className="vm-input min-h-28 resize-y"
            placeholder={c.notePlaceholder}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
          <p className="min-w-0 flex-1 truncate text-sm">
            {geo ? (
              <span className="text-[var(--accent)]">
                {geo.placeName}
                <span className="text-[var(--ink-muted)]"> · {geo.locationSource}</span>
              </span>
            ) : (
              <span className="text-[var(--ink-muted)]">{c.locationUnknown}</span>
            )}
          </p>
          {!geo ? (
            <button
              type="button"
              className="vm-btn-ghost !px-2 !py-1 text-xs"
              onClick={() => void refreshGps()}
            >
              {c.gps}
            </button>
          ) : null}
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--ink-muted)]">
            <input
              type="checkbox"
              checked={attachGps}
              onChange={(e) => setAttachGps(e.target.checked)}
            />
            {c.attach}
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="vm-label mb-0" htmlFor="project">
              {c.projectOptional}
            </label>
            <button
              type="button"
              className="text-xs font-medium text-[var(--accent)]"
              onClick={() => {
                setCreatingProject((v) => !v);
                setError(null);
              }}
            >
              {creatingProject ? c.cancel : c.newProject}
            </button>
          </div>
          {creatingProject ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="vm-input"
                placeholder={c.projectPlaceholder}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                autoFocus
              />
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className={projectListening ? "vm-btn-primary" : "vm-btn-secondary"}
                  onClick={toggleProjectListen}
                  title={c.dictate}
                >
                  {projectListening ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                  {projectListening ? c.stop : c.dictate}
                </button>
                <button
                  type="button"
                  className="vm-btn-primary"
                  disabled={projectBusy || !newProjectName.trim()}
                  onClick={() => void createProjectInline()}
                >
                  {projectBusy ? c.creating : c.create}
                </button>
              </div>
            </div>
          ) : null}
          <select
            id="project"
            className="vm-input"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">{c.autoDetect}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-[var(--ink-muted)]">
          {c.saveFooterBefore}{" "}
          <Link href="/app/vault" className="text-[var(--accent)]">
            {c.vaultSettings}
          </Link>
          {c.saveFooterAfter}
        </p>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={busy} className="vm-btn-primary w-full !py-3.5">
          {busy ? c.saving : c.save}
        </button>
      </form>
    </>
  );
}
