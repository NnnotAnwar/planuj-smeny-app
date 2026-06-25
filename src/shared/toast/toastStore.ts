import { useSyncExternalStore } from 'react';

/**
 * --- TOAST STORE ---
 * A tiny framework-agnostic store for transient notifications. It lives outside
 * React so it can be pushed to from anywhere (mutation `onError`, services),
 * and components subscribe via `useToasts()` (useSyncExternalStore).
 *
 * Scope today: surfacing failed shift actions (start/end/move) that used to be
 * threaded through `useShifts` as an `actionError` string. Admin forms keep
 * their own inline <FormError>, so we deliberately do NOT wire this globally
 * into the React Query MutationCache (that would double-report those).
 */

export type ToastType = 'error' | 'info';
export interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

const AUTO_DISMISS_MS = 5000;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

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
    push(message: string, type: ToastType = 'error') {
        const id = nextId++;
        toasts = [...toasts, { id, message, type }];
        emit();
        setTimeout(() => toastStore.dismiss(id), AUTO_DISMISS_MS);
        return id;
    },
    dismiss(id: number) {
        const next = toasts.filter((t) => t.id !== id);
        if (next.length === toasts.length) return;
        toasts = next;
        emit();
    },
};

/** Imperative helper for non-React callers (mutation onError, services). */
export function toast(message: string, type: ToastType = 'error') {
    return toastStore.push(message, type);
}

/** React subscription to the current toast list. */
export function useToasts() {
    return useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot);
}
