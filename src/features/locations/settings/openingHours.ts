/**
 * --- OPENING HOURS ---
 * Pure helpers around a location's opening hours (`location_settings`), so the
 * rota can use them as the default shift time and flag shifts planned outside
 * them. Times are local "HH:MM"; a closing time at or before the opening time
 * means the place closes after midnight (a bar open 18:00–02:00).
 */

export interface OpeningHours {
    open: string; // HH:MM
    close: string; // HH:MM
}

/** Both times set → the hours; either missing → null (no hours configured). */
export function openingHours(open?: string | null, close?: string | null): OpeningHours | null {
    if (!open || !close) return null;
    return { open: open.slice(0, 5), close: close.slice(0, 5) };
}

const minutes = (hm: string) => {
    const [h, m] = hm.split(':').map(Number);
    return h * 60 + m;
};

/** Local-midnight Date for the calendar day of `d`, shifted by `addDays`. */
const dayStart = (d: Date, addDays = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + addDays);

/** The opening window that begins on the day `base` (plus `addDays`). */
function windowOn(base: Date, hours: OpeningHours, addDays: number): [number, number] {
    const day = dayStart(base, addDays).getTime();
    const open = minutes(hours.open);
    let close = minutes(hours.close);
    if (close <= open) close += 24 * 60; // closes after midnight
    return [day + open * 60_000, day + close * 60_000];
}

/**
 * Does a timed shift fall outside the opening hours? It's inside when it fits
 * entirely in the window that opens on its start day, or in the previous day's
 * window (a 00:30–02:00 shift in a bar that opened the evening before).
 * All-day shifts are never "outside".
 */
export function isOutsideHours(startsAt: string, endsAt: string, hours: OpeningHours | null, allDay = false): boolean {
    if (!hours || allDay) return false;
    const start = new Date(startsAt);
    const s = start.getTime();
    const e = new Date(endsAt).getTime();
    const fits = ([a, b]: [number, number]) => s >= a && e <= b;
    return !(fits(windowOn(start, hours, 0)) || fits(windowOn(start, hours, -1)));
}
