/**
 * --- ANNOUNCEMENT QUERY KEYS ---
 * Single source of truth for the React Query cache keys, so the list query,
 * the mutations and the realtime subscription all read/write the same cache
 * entry (mirrors shiftKeys).
 */
export const announcementKeys = {
  all: ['announcements'] as const,
  list: (orgId: string) => ['announcements', orgId] as const,
};
