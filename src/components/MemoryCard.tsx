import Link from "next/link";
import { FileText, Link2 } from "lucide-react";
import { relativeTime } from "@/lib/utils";
import { hostnameFromUrl } from "@/lib/media/url";

export interface MemoryCardData {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  tags: string[];
  projectName?: string | null;
  createdAt: string;
  status?: string;
  mediaType?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
}

export function MemoryCard({ memory }: { memory: MemoryCardData }) {
  const isLink =
    memory.mediaType === "link" ||
    (!memory.imageUrl && Boolean(memory.sourceUrl) && memory.mediaType !== "document");
  const isDocument = memory.mediaType === "document";
  const host = hostnameFromUrl(memory.sourceUrl);

  return (
    <Link
      href={`/app/memories/${memory.id}`}
      className="vm-card vm-card-interactive group block"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--paper-2)]">
        {memory.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={memory.imageUrl}
            alt={memory.title}
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : isDocument ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[linear-gradient(155deg,var(--paper)_0%,var(--accent-soft)_55%,var(--paper-2)_100%)] px-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--accent)] shadow-sm">
              <FileText className="h-5 w-5" />
            </span>
            <p className="line-clamp-2 font-[family-name:var(--font-serif)] text-lg tracking-tight text-[var(--ink)]">
              {memory.sourceTitle || memory.title || "File"}
            </p>
          </div>
        ) : isLink ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[linear-gradient(155deg,var(--paper)_0%,var(--accent-soft)_55%,var(--paper-2)_100%)] px-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--accent)] shadow-sm">
              <Link2 className="h-5 w-5" />
            </span>
            <p className="font-[family-name:var(--font-serif)] text-lg tracking-tight text-[var(--ink)]">
              {host || "Link"}
            </p>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center bg-[linear-gradient(145deg,var(--paper-2),var(--accent-soft))] px-6 text-center">
            <p className="font-[family-name:var(--font-serif)] text-lg text-[var(--ink-muted)]">
              Voice
            </p>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent opacity-0 transition group-hover:opacity-100" />
        {memory.projectName ? (
          <span className="absolute left-2.5 top-2.5 max-w-[70%] truncate rounded-full bg-[var(--surface)]/92 px-2.5 py-1 text-[11px] font-medium text-[var(--accent)] shadow-sm backdrop-blur">
            {memory.projectName}
          </span>
        ) : null}
      </div>
      <div className="space-y-2 p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 font-[family-name:var(--font-serif)] text-[1.05rem] leading-snug tracking-tight">
            {memory.title}
          </h3>
          <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-[var(--ink-muted)]">
            {relativeTime(memory.createdAt)}
          </span>
        </div>
        {memory.description ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-[var(--ink-muted)]">
            {memory.description}
          </p>
        ) : null}
        {memory.tags.length ? (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {memory.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--ink-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
