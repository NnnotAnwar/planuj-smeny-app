/**
 * --- AVAILABILITY QUERY KEYS ---
 * Cache keys for the member's own entries and the manager's org-wide planning
 * view. Kept together so mutations invalidate the right caches.
 */
export const availabilityKeys = {
  all: ['availability'] as const,
  mine: (userId: string) => ['availability', 'mine', userId] as const,
  org: (orgId: string) => ['availability', 'org', orgId] as const,
};
