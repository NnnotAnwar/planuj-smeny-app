/**
 * --- DATE UTILS ---
 * These helpers make it easy to format dates and times throughout the app.
 * Using a single place for this ensures that the format is the same everywhere.
 */

export type TimeFormat = '12h' | '24h';

// App-wide time-format preference. It's a module-level value (not a hook) so the
// many non-React callers of formatTime stay simple; PreferencesProvider keeps it
// in sync with the user's choice and re-renders consumers when it changes.
let timeFormat: TimeFormat = '24h';
export function setTimeFormatPreference(format: TimeFormat) {
  timeFormat = format;
}

/**
 * Formats an ISO date string into a readable time, honouring the 12h/24h
 * preference. Example: '2026-03-19T10:30:00Z' -> '10:30' or '10:30 AM'.
 */
export function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return '--:--';

  try {
    return new Date(isoString).toLocaleTimeString(timeFormat === '12h' ? 'en-US' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: timeFormat === '12h',
    });
  } catch (err) {
    console.error('Invalid date format:', err, isoString);
    return '--:--';
  }
}

/**
 * Like formatTime, but with a caller-chosen fallback for empty values — used in
 * time ranges (e.g. "08:00 – …" for an ongoing shift). Honours the 12h/24h
 * preference too, so every clock in the app stays consistent.
 */
export function formatClock(isoString: string | null | undefined, fallback = '…'): string {
  if (!isoString) return fallback;
  try {
    return new Date(isoString).toLocaleTimeString(timeFormat === '12h' ? 'en-US' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: timeFormat === '12h',
    });
  } catch {
    return fallback;
  }
}

/**
 * Formats an ISO date string into a readable date (D. Month).
 * Example: '2026-03-19' -> '19 Mar'
 */
export function formatDateShort(isoString: string | null | undefined): string {
  if (!isoString) return '';

  try {
    return new Date(isoString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  } catch (err) {
    console.error(err)
    return '';
  }
}
