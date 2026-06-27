import { useEffect, useRef } from 'react';

/**
 * --- BACK-HANDLER STACK ---
 * A tiny LIFO registry so the Android hardware back button (and Escape) can
 * dismiss the top-most open overlay — a sheet, the command palette, a modal —
 * before navigating routes or exiting the app.
 *
 * Each overlay registers a close callback while it's open (newest on top). The
 * global back-button listener (App.tsx) calls `popBackHandler()`: if something
 * was open it's closed and `true` is returned, so navigation is skipped.
 */

type CloseFn = () => void;

const stack: CloseFn[] = [];

function register(fn: CloseFn): () => void {
    stack.push(fn);
    return () => {
        const i = stack.lastIndexOf(fn);
        if (i >= 0) stack.splice(i, 1);
    };
}

/** Close the top-most registered overlay. Returns true if one was handled. */
export function popBackHandler(): boolean {
    const fn = stack[stack.length - 1];
    if (!fn) return false;
    fn();
    return true;
}

/**
 * Register `onBack` as the top overlay close handler while `active` is true.
 * `onBack` may change between renders without re-registering.
 */
export function useBackHandler(active: boolean, onBack: CloseFn): void {
    const ref = useRef(onBack);

    // Keep the latest callback without re-registering on every render.
    useEffect(() => {
        ref.current = onBack;
    });

    useEffect(() => {
        if (!active) return;
        return register(() => ref.current());
    }, [active]);
}
