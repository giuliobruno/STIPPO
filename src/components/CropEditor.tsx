"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { CropRect } from "@/lib/media/crop";
import { useT } from "@/i18n";

type Props = {
  imageUrl: string;
  onCancel: () => void;
  onApply: (rect: Omit<CropRect, "imageWidth" | "imageHeight">) => void;
};

type DragState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

/**
 * Simple region crop overlay — drag a rectangle over the preview image.
 */
export function CropEditor({ imageUrl, onCancel, onApply }: Props) {
  const crop = useT().crop;
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [selection, setSelection] = useState<DragState | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const clientToImage = useCallback((clientX: number, clientY: number) => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return { x: 0, y: 0 };
    const box = img.getBoundingClientRect();
    const scaleX = img.naturalWidth / box.width;
    const scaleY = img.naturalHeight / box.height;
    return {
      x: Math.max(0, Math.min(img.naturalWidth, (clientX - box.left) * scaleX)),
      y: Math.max(0, Math.min(img.naturalHeight, (clientY - box.top) * scaleY)),
    };
  }, []);

  function onPointerDown(e: ReactPointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = clientToImage(e.clientX, e.clientY);
    const next = { startX: p.x, startY: p.y, currentX: p.x, currentY: p.y };
    setDrag(next);
    setSelection(next);
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!drag) return;
    const p = clientToImage(e.clientX, e.clientY);
    setDrag({ ...drag, currentX: p.x, currentY: p.y });
    setSelection({ ...drag, currentX: p.x, currentY: p.y });
  }

  function onPointerUp() {
    setDrag(null);
  }

  const active = selection;
  const rect =
    active && natural.w > 0
      ? normalizeRect(active)
      : null;

  const overlayStyle = rect && imgRef.current
    ? imageRectToCss(rect, imgRef.current)
    : null;

  function apply() {
    if (!rect || rect.width < 4 || rect.height < 4) return;
    onApply(rect);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col gap-3 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">{crop.title}</p>
          <p className="text-xs text-white/70">{crop.hint}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="vm-btn-secondary flex-1 !bg-white/10 !text-white !border-white/20 sm:flex-none" onClick={onCancel}>
            {crop.cancel}
          </button>
          <button
            type="button"
            className="vm-btn-primary flex-1 sm:flex-none"
            disabled={!rect || rect.width < 4 || rect.height < 4}
            onClick={apply}
          >
            {crop.apply}
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        <div className="relative max-h-full max-w-full touch-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt={crop.alt}
            className="max-h-[min(80vh,720px)] max-w-full select-none"
            draggable={false}
            onLoad={(e) => {
              const el = e.currentTarget;
              setNatural({ w: el.naturalWidth, h: el.naturalHeight });
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          {overlayStyle ? (
            <div
              className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              style={overlayStyle}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function normalizeRect(d: DragState) {
  const x = Math.min(d.startX, d.currentX);
  const y = Math.min(d.startY, d.currentY);
  const width = Math.abs(d.currentX - d.startX);
  const height = Math.abs(d.currentY - d.startY);
  return { x, y, width, height };
}

function imageRectToCss(
  rect: { x: number; y: number; width: number; height: number },
  img: HTMLImageElement
): CSSProperties {
  const box = img.getBoundingClientRect();
  const parent = img.parentElement?.getBoundingClientRect();
  if (!parent || !img.naturalWidth) return {};
  const scaleX = box.width / img.naturalWidth;
  const scaleY = box.height / img.naturalHeight;
  const offsetLeft = box.left - parent.left;
  const offsetTop = box.top - parent.top;
  return {
    left: offsetLeft + rect.x * scaleX,
    top: offsetTop + rect.y * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  };
}
