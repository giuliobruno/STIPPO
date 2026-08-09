"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, SwitchCamera, Video, X } from "lucide-react";
import { pickRecorderMimeType } from "@/lib/media/device";
import { useT } from "@/i18n";

type LiveCameraProps = {
  mode: "photo" | "video";
  maxVideoMs: number;
  onClose: () => void;
  onCapture: (file: File) => void;
};

export function LiveCamera({ mode, maxVideoMs, onClose, onCapture }: LiveCameraProps) {
  const t = useT();
  const c = t.capture;
  const videoElRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const facingRef = useRef<"user" | "environment">("environment");

  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [canFlip, setCanFlip] = useState(false);

  async function startStream(facing: "user" | "environment") {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setReady(false);
    setError(null);

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: mode === "video",
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch {
        // Desktop webcams often reject facingMode — fall back to any camera.
        stream = await navigator.mediaDevices.getUserMedia({
          audio: mode === "video",
          video: true,
        });
      }
      streamRef.current = stream;
      facingRef.current = facing;
      const el = videoElRef.current;
      if (el) {
        el.srcObject = stream;
        await el.play().catch(() => undefined);
      }
      setReady(true);

      if (navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCanFlip(devices.filter((d) => d.kind === "videoinput").length > 1);
      }
    } catch {
      setError(c.errCameraDenied);
    }
  }

  useEffect(() => {
    void startStream("environment");
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per open
  }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function takePhoto() {
    const el = videoElRef.current;
    const stream = streamRef.current;
    if (!el || !stream || !ready) return;

    const track = stream.getVideoTracks()[0];
    const settings = track?.getSettings();
    const w = el.videoWidth || settings?.width || 1280;
    const h = el.videoHeight || settings?.height || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError(c.errCapture);
      return;
    }
    ctx.drawImage(el, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError(c.errCapture);
          return;
        }
        stream.getTracks().forEach((t) => t.stop());
        onCapture(
          new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" })
        );
      },
      "image/jpeg",
      0.92
    );
  }

  function stopRecording() {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    rec.stop();
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || !ready || recording) return;

    const mimeType = pickRecorderMimeType();
    if (!mimeType && typeof MediaRecorder === "undefined") {
      setError(c.errCameraUnavailable);
      return;
    }

    chunksRef.current = [];
    let rec: MediaRecorder;
    try {
      rec = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      setError(c.errCameraUnavailable);
      return;
    }

    recorderRef.current = rec;
    rec.ondataavailable = (ev) => {
      if (ev.data.size) chunksRef.current.push(ev.data);
    };
    rec.onstop = () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecording(false);
      const type = rec.mimeType || mimeType || "video/webm";
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      stream.getTracks().forEach((t) => t.stop());
      onCapture(
        new File([blob], `camera-${Date.now()}.${ext}`, { type })
      );
    };

    rec.start(250);
    setRecording(true);
    setElapsedMs(0);
    const started = Date.now();
    timerRef.current = window.setInterval(() => {
      const ms = Date.now() - started;
      setElapsedMs(ms);
      if (ms >= maxVideoMs) stopRecording();
    }, 200);
  }

  const elapsedLabel = `${Math.floor(elapsedMs / 1000)}s`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-medium">
          {mode === "photo" ? c.livePhotoTitle : c.liveVideoTitle}
        </p>
        <button
          type="button"
          className="rounded-full bg-white/15 p-2 backdrop-blur-sm transition hover:bg-white/25"
          aria-label={c.cancel}
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 bg-black">
        <video
          ref={videoElRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-contain"
        />
        {recording ? (
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-medium">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            {elapsedLabel}
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
            <p className="max-w-sm text-sm text-white/90">{error}</p>
          </div>
        ) : null}
        {!ready && !error ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
            {c.liveStarting}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-6 px-4 py-6">
        {canFlip ? (
          <button
            type="button"
            className="rounded-full bg-white/15 p-3 backdrop-blur-sm transition hover:bg-white/25 disabled:opacity-40"
            aria-label={c.liveFlip}
            disabled={recording}
            onClick={() =>
              void startStream(
                facingRef.current === "environment" ? "user" : "environment"
              )
            }
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
        ) : (
          <span className="w-11" />
        )}

        {mode === "photo" ? (
          <button
            type="button"
            disabled={!ready || Boolean(error)}
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 transition hover:bg-white/35 disabled:opacity-40"
            aria-label={c.photo}
            onClick={takePhoto}
          >
            <Camera className="h-7 w-7" />
          </button>
        ) : recording ? (
          <button
            type="button"
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-red-600 transition hover:bg-red-500"
            aria-label={c.stop}
            onClick={stopRecording}
          >
            <span className="h-5 w-5 rounded-sm bg-white" />
          </button>
        ) : (
          <button
            type="button"
            disabled={!ready || Boolean(error)}
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-red-600/80 transition hover:bg-red-500 disabled:opacity-40"
            aria-label={c.video}
            onClick={startRecording}
          >
            <Video className="h-7 w-7" />
          </button>
        )}

        <span className="w-11" />
      </div>
    </div>
  );
}
