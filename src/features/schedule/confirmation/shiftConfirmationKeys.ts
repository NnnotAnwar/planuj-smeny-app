/**
 * --- SHIFT CONFIRMATION QUERY KEYS ---
 * One place for the React Query cache keys shared by the member's own
 * confirmations and the manager's org-wide view.
 */
export const shiftConfirmationKeys = {
  all: ['shift-confirmations'] as const,
  mine: (userId: string) => ['shift-confirmations', 'mine', userId] as const,
  org: (orgId: string) => ['shift-confirmations', 'org', orgId] as const,
};
