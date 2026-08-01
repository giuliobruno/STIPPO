export const PLAN_LIMITS = {
  free: Number(process.env.FREE_MEMORY_LIMIT || 100),
  pro: Number.POSITIVE_INFINITY,
  team: Number.POSITIVE_INFINITY,
} as const;
