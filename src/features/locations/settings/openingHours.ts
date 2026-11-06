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

const localHM = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Is this the location's "full day" — a shift exactly matching its opening
 * hours? The rota shows those as the location letter, same as an all-day mark.
 */
export function isHoursShift(startsAt: string, endsAt: string, allDay: boolean, hours: OpeningHours | null): boolean {
    if (allDay || !hours) return false;
    const span = Date.parse(endsAt) - Date.parse(startsAt);
    return span > 0 && span <= 24 * 3_600_000 && localHM(startsAt) === hours.open && localHM(endsAt) === hours.close;
}

/**
 * The "full day" shift for a date: the opening hours when the location has them
 * (stored as real times, so hours, late alerts and exports are right), else an
 * all-day mark spanning local midnight to midnight.
 */
export function fullDayShift(date: string, hours: OpeningHours | null): { starts_at: string; ends_at: string; all_day: boolean } {
    const [y, m, d] = date.split('-').map(Number);
    if (!hours) {
        return { starts_at: new Date(y, m - 1, d).toISOString(), ends_at: new Date(y, m - 1, d + 1).toISOString(), all_day: true };
    }
    const [oh, om] = hours.open.split(':').map(Number);
    const [ch, cm] = hours.close.split(':').map(Number);
    const start = new Date(y, m - 1, d, oh, om);
    const closesNextDay = ch * 60 + cm <= oh * 60 + om;
    const end = new Date(y, m - 1, d + (closesNextDay ? 1 : 0), ch, cm);
    return { starts_at: start.toISOString(), ends_at: end.toISOString(), all_day: false };
}
