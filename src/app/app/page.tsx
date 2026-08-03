import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { parseJsonArray } from "@/lib/utils";
import { MemoryCard } from "@/components/MemoryCard";

type Props = { searchParams: { projectId?: string } };

export default async function FeedPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const storage = getStorage();
  const projectId = searchParams.projectId;

  const project = projectId
    ? await prisma.project.findFirst({
        where: { id: projectId, userId },
      })
    : null;

  const memories = await prisma.memory.findMany({
    where: {
      userId,
      ...(projectId ? { projectId } : {}),
    },
    include: { project: true },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return (
    <div className="space-y-6">
        <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-serif)] text-3xl">
            {project ? project.name : "Recent memories"}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {project
              ? `${memories.length} references in this project`
              : "Capture first. Organize automatically."}
          </p>
          {project ? (
            <Link href="/app" className="mt-2 inline-block text-xs text-[var(--accent)]">
              Clear project filter
            </Link>
          ) : null}
        </div>
        <div className="hidden gap-2 sm:flex">
          <Link href="/app/capture?mode=clip" className="vm-btn-secondary">
            Clip
          </Link>
          <Link href="/app/capture" className="vm-btn-primary">
            + Capture
          </Link>
        </div>
      </div>

      {memories.length === 0 ? (
        <div className="vm-card flex flex-col items-start gap-4 p-8">
          <h3 className="font-[family-name:var(--font-serif)] text-2xl">
            Your feed is empty
          </h3>
          <p className="max-w-md text-sm text-[var(--ink-muted)]">
            Clip a facade detail from a screenshot, add a voice note about the Milan
            hotel, and ask for it later.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/capture?mode=clip" className="vm-btn-primary">
              Create a clip
            </Link>
            <Link href="/app/capture" className="vm-btn-secondary">
              Open Capture
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memories.map((m) => (
            <MemoryCard
              key={m.id}
              memory={{
                id: m.id,
                title: m.title,
                description: m.description,
                imageUrl:
                  m.mediaType === "image"
                    ? storage.getPublicUrl(m.thumbnailKey || m.originalKey)
                    : null,
                tags: parseJsonArray(m.tagsJson),
                projectName: m.project?.name ?? null,
                createdAt: m.createdAt.toISOString(),
                status: m.status,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
