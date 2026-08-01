import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { parseJsonArray, parseJsonObject, relativeTime } from "@/lib/utils";
import { DeleteMemoryButton } from "@/components/DeleteMemoryButton";

type Props = { params: { id: string } };

export default async function MemoryDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const memory = await prisma.memory.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { project: true },
  });
  if (!memory) notFound();

  const storage = getStorage();
  const tags = parseJsonArray(memory.tagsJson);
  const objects = parseJsonArray(memory.objectsJson);
  const entities = parseJsonObject(memory.entitiesJson, {
    materials: [],
    people: [],
    companies: [],
    locations: [],
    concepts: [],
    projects: [],
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href="/app" className="vm-btn-ghost !px-0">
        ← Back to feed
      </Link>

      {memory.mediaType === "image" ? (
        <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--paper-2)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={storage.getPublicUrl(memory.originalKey)}
            alt={memory.title}
            className="max-h-[28rem] w-full object-contain"
          />
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-[family-name:var(--font-serif)] text-4xl leading-tight">
            {memory.title}
          </h1>
          <span className="text-xs text-[var(--ink-muted)]">
            {relativeTime(memory.createdAt)}
          </span>
        </div>
        {memory.project ? (
          <span className="vm-chip">{memory.project.name}</span>
        ) : memory.projectSuggested ? (
          <span className="rounded-full border border-dashed border-[var(--line)] px-2.5 py-1 text-xs text-[var(--ink-muted)]">
            Suggested: {memory.projectSuggested}
          </span>
        ) : null}
        <p className="text-[var(--ink-muted)]">
          {memory.aiSummary || memory.description}
        </p>
      </div>

        {memory.transcript ? (
        <section className="vm-card space-y-2 p-5">
          <h2 className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--ink-muted)]">
            Voice transcript
          </h2>
          <p className="font-[family-name:var(--font-serif)] text-xl leading-relaxed">
            “{memory.transcript}”
          </p>
          {memory.intent ? (
            <p className="text-xs text-[var(--accent)]">Intent: {memory.intent}</p>
          ) : null}
        </section>
      ) : null}

      {memory.placeName || (memory.latitude != null && memory.longitude != null) ? (
        <section className="vm-card space-y-2 p-5">
          <h2 className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--ink-muted)]">
            Location
          </h2>
          <p className="text-sm">
            {memory.placeName ||
              `${memory.latitude?.toFixed(5)}, ${memory.longitude?.toFixed(5)}`}
          </p>
          <p className="text-xs text-[var(--ink-muted)]">
            Source: {memory.locationSource || "unknown"}
            {memory.latitude != null && memory.longitude != null
              ? ` · ${memory.latitude.toFixed(5)}, ${memory.longitude.toFixed(5)}`
              : ""}
          </p>
          <p className="text-xs text-[var(--ink-muted)]">
            Sync: {memory.syncStatus}
            {memory.originalSyncEnabled ? " · full-res cloud" : " · thumbnail + index"}
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="vm-card p-5">
          <h2 className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--ink-muted)]">
            Tags
          </h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="vm-chip">
                {t}
              </span>
            ))}
            {tags.length === 0 ? (
              <span className="text-sm text-[var(--ink-muted)]">None</span>
            ) : null}
          </div>
        </section>
        <section className="vm-card p-5">
          <h2 className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--ink-muted)]">
            Detected objects
          </h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {objects.map((o) => (
              <span
                key={o}
                className="rounded-full border border-[var(--line)] px-2.5 py-1 text-xs"
              >
                {o}
              </span>
            ))}
            {objects.length === 0 ? (
              <span className="text-sm text-[var(--ink-muted)]">None</span>
            ) : null}
          </div>
        </section>
      </div>

      <section className="vm-card p-5">
        <h2 className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--ink-muted)]">
          Entities
        </h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {(
            [
              ["Materials", entities.materials],
              ["Locations", entities.locations],
              ["Concepts", entities.concepts],
              ["Companies", entities.companies],
            ] as const
          ).map(([label, values]) => (
            <div key={label}>
              <dt className="text-[var(--ink-muted)]">{label}</dt>
              <dd className="mt-1">{values.join(", ") || "—"}</dd>
            </div>
          ))}
        </dl>
        {memory.ocrText ? (
          <p className="mt-4 border-t border-[var(--line)] pt-4 text-sm text-[var(--ink-muted)]">
            OCR: {memory.ocrText}
          </p>
        ) : null}
      </section>

      <DeleteMemoryButton id={memory.id} />
    </div>
  );
}
