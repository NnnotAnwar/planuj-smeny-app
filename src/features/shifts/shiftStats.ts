import { type Shift } from '@shared/types';

/**
 * --- SHIFT STATS HELPERS ---
 * Pure, dependency-free functions used by the Overview page. Extracted so they
 * can be unit-tested without rendering the page.
 */

const MS_PER_HOUR = 1000 * 60 * 60;

/**
 * Deducts mandatory breaks per Czech labour law (přestávky):
 * −30 min for every started 6-hour block (triggers at 6h 1m, 12h 1m, …).
 */
export function calculateNetHours(grossHours: number): number {
    if (grossHours <= 0) return 0;
    const breakCount = Math.floor((grossHours - 0.0001) / 6);
    const totalBreakTime = breakCount * 0.5; // 0.5h = 30 min
    return Math.max(0, grossHours - totalBreakTime);
}

/** Raw clocked hours (Gross). Open shifts count up to `now`. */
export function shiftGrossHours(s: Pick<Shift, 'started_at' | 'ended_at'>, now: number = Date.now()): number {
    const start = new Date(s.started_at).getTime();
    const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
    return Math.max(0, (end - start) / MS_PER_HOUR);
}

/** Net working hours, with mandatory breaks deducted. */
export function shiftHours(s: Pick<Shift, 'started_at' | 'ended_at'>, now: number = Date.now()): number {
    return calculateNetHours(shiftGrossHours(s, now));
}

/** Break time deducted for a shift (gross − net). */
export function shiftBreakHours(s: Pick<Shift, 'started_at' | 'ended_at'>, now: number = Date.now()): number {
    return shiftGrossHours(s, now) - shiftHours(s, now);
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
