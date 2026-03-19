/**
 * --- DATE UTILS ---
 * These helpers make it easy to format dates and times throughout the app.
 * Using a single place for this ensures that the format (like 'en-GB') is the same everywhere.
 */

/**
 * Formats an ISO date string into a readable time (HH:MM).
 * Example: '2026-03-19T10:30:00Z' -> '10:30'
 */
export function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return '--:--';
  
  try {
    return new Date(isoString).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (err) {
    console.error('Invalid date format:', isoString);
    return '--:--';
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
    return '';
  }
}
