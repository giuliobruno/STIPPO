import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewProjectForm } from "@/components/NewProjectForm";

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  const projects = await prisma.project.findMany({
    where: { userId: session!.user.id },
    include: { _count: { select: { memories: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-serif)] text-3xl">Projects</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          The natural unit of organization for studio work — not folders.
        </p>
      </div>

      <NewProjectForm />

      <div className="grid gap-3 sm:grid-cols-2">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/app?projectId=${p.id}`}
            className="vm-card block p-5 hover:border-[var(--accent)]/30"
          >
            <h3 className="font-[family-name:var(--font-serif)] text-xl">{p.name}</h3>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              {[p.location, p.clientName].filter(Boolean).join(" · ") || "No location yet"}
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.08em] text-[var(--accent)]">
              {p._count.memories} memories
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
