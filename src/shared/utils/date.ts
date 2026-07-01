/**
 * --- DATE UTILS ---
 * Single place for date/time formatting so it stays consistent app-wide and
 * follows the user's preferences:
 *   - `timeFormat` (12h / 24h) toggles AM-PM vs 24-hour clocks.
 *   - `locale` (derived from the UI language) localises month / weekday names.
 * Both are module-level values (not hooks) so the many non-React callers stay
 * simple; PreferencesProvider keeps them in sync and re-renders consumers.
 */

export type TimeFormat = '12h' | '24h';

let timeFormat: TimeFormat = '24h';
let locale = 'en-GB';

export function setTimeFormatPreference(format: TimeFormat) {
  timeFormat = format;
}

export function setLocalePreference(language: string) {
  locale = language === 'cs' ? 'cs-CZ' : 'en-GB';
}

const hour12 = () => timeFormat === '12h';

/**
 * Formats an ISO date string into a readable time, honouring the 12h/24h
 * preference. Example: '10:30' or '10:30 AM'.
 */
export function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return '--:--';
  try {
    return new Date(isoString).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: hour12() });
  } catch (err) {
    console.error('Invalid date format:', err, isoString);
    return '--:--';
  }
}

/**
 * Like formatTime, but with a caller-chosen fallback for empty values — used in
 * time ranges (e.g. "08:00 – …" for an ongoing shift).
 */
export function formatClock(isoString: string | null | undefined, fallback = '…'): string {
  if (!isoString) return fallback;
  try {
    return new Date(isoString).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: hour12() });
  } catch {
    return fallback;
  }
}

/** Wall clock for the header — optional seconds, honours 12h/24h + locale. */
export function formatWallClock(date: Date, withSeconds = false): string {
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: hour12(),
  });
}

/** Short date + time (e.g. "26 Jun, 14:30"), localised + 12h/24h aware. */
export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: hour12(),
    });
  } catch {
    return '';
  }
}

/** "19 Jun" — localised short day + month. */
export function formatDateShort(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  } catch (err) {
    console.error(err);
    return '';
  }
}

/** Localised "Mon, 19 Jun 2026" for a date input's selected-value display. */
export function formatDateLong(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/** Localised short month for a Date (e.g. "Jun" / "čvn"). */
export function monthShort(date: Date): string {
  return date.toLocaleDateString(locale, { month: 'short' });
}

/**
 * `YYYY-MM` for an ISO instant in the *local* timezone — the month the user
 * actually sees the shift on. Use this to bucket shifts by month instead of the
 * UTC string prefix, which mis-files shifts near midnight (e.g. 01:56 on Jul 1
 * local is 23:56 Jun 30 UTC).
 */
export function monthKey(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Localised full month for a Date (e.g. "June" / "červen"). */
export function monthLong(date: Date): string {
  return date.toLocaleDateString(locale, { month: 'long' });
}

/** Localised short weekday for a Date (e.g. "Mon" / "po"). */
export function weekdayShort(date: Date): string {
  return date.toLocaleDateString(locale, { weekday: 'short' });
}

/** Seven localised short weekday labels, Monday-first (for weekday charts). */
export function weekdayShortLabels(): string[] {
  // 2024-01-01 is a Monday; walk seven days for stable Mon-first labels.
  return Array.from({ length: 7 }, (_, i) => weekdayShort(new Date(2024, 0, 1 + i)));
}
