/**
 * Tiny pub-sub so a deep link (a tapped push with `?openNotifications=1`) can
 * open the notifications bell — used when the event has no dedicated screen the
 * recipient can navigate to (e.g. an admin changed their profile). The signal is
 * fired once (by AppShell reading the query param); every mounted bell opens,
 * but only the one visible at the current breakpoint is shown.
 */

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeOpenNotifications(fn: Listener): () => void {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
}

export function openNotificationsPanel(): void {
    listeners.forEach((fn) => fn());
}
