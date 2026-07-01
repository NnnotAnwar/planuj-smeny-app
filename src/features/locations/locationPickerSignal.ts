/**
 * --- LOCATION PICKER SIGNAL ---
 * A tiny pub-sub so an action elsewhere (e.g. tapping "Start shift" without a
 * location picked) can nudge the mobile location picker to open, instead of the
 * old dead-end disabled button. Mirrors the notifications-panel signal pattern.
 */

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeOpenLocationPicker(fn: Listener): () => void {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
}

/** Opens any subscribed picker. Returns false if nothing is listening (e.g. on
 *  desktop, where the mobile field isn't mounted) so the caller can fall back. */
export function openLocationPicker(): boolean {
    listeners.forEach((l) => l());
    return listeners.size > 0;
}
