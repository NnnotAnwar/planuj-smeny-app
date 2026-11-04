import { useState } from 'react';

/**
 * --- useDismissibleWarning ---
 * A warning the user can silence with a "don't show this again" checkbox. The
 * choice is remembered per-viewer in localStorage (per-device, not synced). Use
 * for advisory confirmations like "this day is a public holiday — assign anyway?"
 *
 *   const holidayWarn = useDismissibleWarning('assign-on-holiday');
 *   if (!holidayWarn.dismissed) open the dialog;
 *   // dialog's "don't show again" + confirm → holidayWarn.dismissForever()
 *
 * Every storage access is guarded (private mode / blocked storage throw), and
 * the warning simply shows every time if storage is unavailable.
 */
export function useDismissibleWarning(key: string) {
  const storageKey = `warn:${key}:dismissed`;

  const read = (): boolean => {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  };

  const [dismissed, setDismissed] = useState<boolean>(read);

  /** Remember "don't show again" for this warning. */
  const dismissForever = () => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* storage unavailable — warning will just show next time */
    }
    setDismissed(true);
  };

  /** Clear the preference so the warning shows again (e.g. from Settings). */
  const reset = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setDismissed(false);
  };

  return { dismissed, dismissForever, reset };
}
