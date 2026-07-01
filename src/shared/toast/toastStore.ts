import { useSyncExternalStore } from 'react';

/**
 * --- TOAST STORE ---
 * A tiny framework-agnostic store for transient notifications. It lives outside
 * React so it can be pushed to from anywhere (mutation `onError`, services),
 * and components subscribe via `useToasts()` (useSyncExternalStore).
 *
 * Supports three intents (error / success / info) and an optional inline
 * ACTION button — used for "undo" on optimistic writes: the UI removes a row
 * immediately, shows a success toast with an Undo action, and only commits the
 * change to the server once the toast's window elapses.
 */

export type ToastType = 'error' | 'success' | 'info';

export interface ToastAction {
    /** Button label, e.g. "Undo". */
    label: string;
    /** Invoked when the action is tapped. The toast auto-dismisses afterwards. */
    onClick: () => void;
}

export interface Toast {
    id: number;
    message: string;
    type: ToastType;
    action?: ToastAction;
}

export interface ToastOptions {
    /** Milliseconds before auto-dismiss. Defaults to 5000 (or the undo window). */
    duration?: number;
    /** Optional inline action (e.g. Undo). */
    action?: ToastAction;
    /** Called when the toast leaves the screen WITHOUT the action being used. */
    onExpire?: () => void;
}

const DEFAULT_DISMISS_MS = 5000;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
// Per-toast bookkeeping so we can cancel the auto-dismiss timer and know whether
// a toast was resolved via its action vs. left to expire.
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const expiries = new Map<number, () => void>();
const consumed = new Set<number>();

function emit() {
    // New array identity is published below, so useSyncExternalStore re-renders.
    listeners.forEach((l) => l());
}

export const toastStore = {
    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
    getSnapshot() {
        return toasts;
    },
    push(message: string, type: ToastType = 'error', opts: ToastOptions = {}) {
        const id = nextId++;
        toasts = [...toasts, { id, message, type, action: opts.action }];
        if (opts.onExpire) expiries.set(id, opts.onExpire);
        emit();
        const timer = setTimeout(() => toastStore.dismiss(id), opts.duration ?? DEFAULT_DISMISS_MS);
        timers.set(id, timer);
        return id;
    },
    /** Remove a toast. `viaAction` marks it resolved so `onExpire` is skipped. */
    dismiss(id: number, viaAction = false) {
        const timer = timers.get(id);
        if (timer) {
            clearTimeout(timer);
            timers.delete(id);
        }
        if (viaAction) consumed.add(id);
        const onExpire = expiries.get(id);
        if (onExpire && !consumed.has(id)) onExpire();
        expiries.delete(id);
        consumed.delete(id);

        const next = toasts.filter((t) => t.id !== id);
        if (next.length === toasts.length) return;
        toasts = next;
        emit();
    },
};

/** Imperative helper for non-React callers (mutation onError, services). */
export function toast(message: string, type: ToastType = 'error', opts: ToastOptions = {}) {
    return toastStore.push(message, type, opts);
}

/** React subscription to the current toast list. */
export function useToasts() {
    return useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot);
}
