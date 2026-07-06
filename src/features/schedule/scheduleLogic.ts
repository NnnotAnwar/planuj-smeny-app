/**
 * --- SCHEDULE LOGIC (pure) ---
 * Date/pattern math for the rota, extracted from SchedulePage so it can be unit
 * tested in isolation. No React, no I/O — just calendar arithmetic.
 */

export type WeekPattern = 'short' | 'long';

/** Monday-first weekday index (0 = Mon … 6 = Sun) for a Date. */
export function mondayFirstDow(date: Date): number {
    return (date.getDay() + 6) % 7;
}

/** Number of days in the month `YYYY-MM`. */
export function monthDayCount(monthKey: string): number {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(y, m, 0).getDate();
}

/** Monday-first weekday offset of the 1st of the month (0 = starts Monday). */
export function firstDowOffset(monthKey: string): number {
    const [y, m] = monthKey.split('-').map(Number);
    return mondayFirstDow(new Date(y, m - 1, 1));
}

/**
 * The days (1-based) a restaurant quick-fill should mark for one person.
 *   - 'short' starts with a SHORT week (Wed+Thu only), alternating;
 *   - 'long' starts with a LONG week (all days except Wed+Thu), alternating.
 * Week parity is computed Monday-first from the 1st of the month. This is the
 * pattern only — callers still skip days that are blocked or on approved leave.
 */
export function quickFillDays(monthKey: string, action: WeekPattern): number[] {
    const [y, m] = monthKey.split('-').map(Number);
    const days = monthDayCount(monthKey);
    const offset = firstDowOffset(monthKey);
    const out: number[] = [];
    for (let day = 1; day <= days; day++) {
        const dow = mondayFirstDow(new Date(y, m - 1, day));
        const weekIndex = Math.floor((day - 1 + offset) / 7);
        const isShortWeek = action === 'short' ? weekIndex % 2 === 0 : weekIndex % 2 === 1;
        const included = isShortWeek ? dow === 2 || dow === 3 : dow !== 2 && dow !== 3;
        if (included) out.push(day);
    }
    return out;
}

/**
 * Map a source-month shift date to the same (week-index, weekday) slot in the
 * target month, so a Monday in week 2 lands on the target's week-2 Monday.
 * Returns a 1-based day number that may be out of range (caller must bound it).
 */
export function copyTargetDay(sourceDate: Date, prevOffset: number, targetOffset: number): number {
    const dow = mondayFirstDow(sourceDate);
    const weekIdx = Math.floor((sourceDate.getDate() - 1 + prevOffset) / 7);
    return weekIdx * 7 + dow - targetOffset + 1;
}
