import Link from "next/link";
import { relativeTime } from "@/lib/utils";

export interface MemoryCardData {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  tags: string[];
  projectName?: string | null;
  createdAt: string;
  status?: string;
}

export function MemoryCard({ memory }: { memory: MemoryCardData }) {
  return (
    <Link href={`/app/memories/${memory.id}`} className="vm-card group block">
      <div className="aspect-[4/3] bg-[var(--paper-2)]">
        {memory.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={memory.imageUrl}
            alt={memory.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--ink-muted)]">
            Voice memory
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-[family-name:var(--font-serif)] text-lg leading-snug">
            {memory.title}
          </h3>
          <span className="shrink-0 text-[11px] text-[var(--ink-muted)]">
            {relativeTime(memory.createdAt)}
          </span>
        </div>
        {memory.description ? (
          <p className="line-clamp-2 text-sm text-[var(--ink-muted)]">
            {memory.description}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {memory.projectName ? (
            <span className="vm-chip">{memory.projectName}</span>
          ) : null}
          {memory.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--ink-muted)]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
