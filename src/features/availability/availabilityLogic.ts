import type { Availability } from './types';

/**
 * The availability entry that applies to a member on a local day
 * (`YYYY-MM-DD`), if any. A one-off date beats a weekly rule, and
 * "can't work" beats "would like to" — the rota should surface the
 * constraint, not the wish, when both exist.
 */
export function availabilityOn(entries: Availability[], userId: string, date: string): Availability | undefined {
    const [y, m, d] = date.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay(); // 0 = Sun, matches day_of_week
    const matches = entries.filter(
        (e) => e.user_id === userId && (e.specific_date === date || (!e.specific_date && e.day_of_week === dow)),
    );
    if (matches.length === 0) return undefined;
    const rank = (e: Availability) => (e.kind === 'unavailable' ? 0 : 2) + (e.specific_date ? 0 : 1);
    return [...matches].sort((a, b) => rank(a) - rank(b))[0];
}

/** "08:00–12:00" for a time-bounded entry, '' when it covers the whole day. */
export function availabilityWindow(e: Pick<Availability, 'all_day' | 'start_time' | 'end_time'>): string {
    if (e.all_day || !e.start_time || !e.end_time) return '';
    return `${e.start_time.slice(0, 5)}–${e.end_time.slice(0, 5)}`;
}
