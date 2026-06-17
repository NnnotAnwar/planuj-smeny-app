import { type Shift } from '@shared/types';

/**
 * --- SHIFT STATS HELPERS ---
 * Pure, dependency-free functions used by My Shifts. Extracted so they can be
 * unit-tested without rendering the page.
 */

const MS_PER_HOUR = 1000 * 60 * 60;

/** Hours a shift lasted. Open shifts (no ended_at) count up to `now`. */
export function shiftHours(s: Pick<Shift, 'started_at' | 'ended_at'>, now: number = Date.now()): number {
    const start = new Date(s.started_at).getTime();
    const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
    return Math.max(0, (end - start) / MS_PER_HOUR);
}

/** Compact hours label, e.g. 7.5 -> "7.5h", 124 -> "124h". */
export function fmtHours(h: number): string {
    return `${Math.round(h * 10) / 10}h`;
}

/** Human duration, e.g. 8.25 -> "8h 15m", 0.5 -> "30m". */
export function fmtDuration(h: number): string {
    const totalMin = Math.round(h * 60);
    const hrs = Math.floor(totalMin / 60);
    const min = totalMin % 60;
    return hrs > 0 ? `${hrs}h ${min}m` : `${min}m`;
}
