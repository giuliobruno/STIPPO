import { prisma } from "@/lib/prisma";

/** Ensure projectId belongs to the user (or is null). */
export async function assertOwnedProjectId(
  userId: string,
  projectId: string | null | undefined
): Promise<string | null | undefined> {
  if (projectId === undefined) return undefined;
  if (projectId === null || projectId === "") return null;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) {
    throw Object.assign(new Error("Project not found."), { status: 400 });
  }
  return project.id;
}
