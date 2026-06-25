/**
 * --- SHIFT QUERY KEYS ---
 * Single source of truth for the React Query cache keys used across the shift
 * queries, mutations and the realtime hook. Keeping them here avoids drift
 * between the code that reads the cache and the code that writes to it.
 */
export const shiftKeys = {
    all: ['shifts'] as const,
    active: (userId: string) => ['shifts', 'active', userId] as const,
    board: (orgId: string) => ['shifts', 'board', orgId] as const,
    history: (userId: string) => ['shifts', 'history', userId] as const,
    locations: (orgId: string) => ['locations', orgId] as const,
};
