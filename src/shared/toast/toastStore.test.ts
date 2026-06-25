import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toastStore, toast } from './toastStore';

// The store is a module-level singleton, so clear it between tests.
function clearAll() {
    for (const t of toastStore.getSnapshot()) toastStore.dismiss(t.id);
}

describe('toastStore', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        clearAll();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('pushes a toast and exposes it in the snapshot', () => {
        const id = toast('Something failed');
        const snap = toastStore.getSnapshot();
        expect(snap).toHaveLength(1);
        expect(snap[0]).toMatchObject({ id, message: 'Something failed', type: 'error' });
    });

    it('supports an explicit type', () => {
        toast('heads up', 'info');
        expect(toastStore.getSnapshot()[0].type).toBe('info');
    });

    it('dismiss removes only the matching toast', () => {
        const a = toast('a');
        toast('b');
        toastStore.dismiss(a);
        const snap = toastStore.getSnapshot();
        expect(snap).toHaveLength(1);
        expect(snap[0].message).toBe('b');
    });

    it('auto-dismisses after the timeout', () => {
        toast('temporary');
        expect(toastStore.getSnapshot()).toHaveLength(1);
        vi.advanceTimersByTime(5000);
        expect(toastStore.getSnapshot()).toHaveLength(0);
    });

    it('notifies subscribers on push and dismiss, and stops after unsubscribe', () => {
        const listener = vi.fn();
        const unsubscribe = toastStore.subscribe(listener);
        const id = toast('x');
        expect(listener).toHaveBeenCalledTimes(1);
        toastStore.dismiss(id);
        expect(listener).toHaveBeenCalledTimes(2);
        unsubscribe();
        toast('y');
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('publishes a new array identity so external stores detect changes', () => {
        const before = toastStore.getSnapshot();
        toast('x');
        expect(toastStore.getSnapshot()).not.toBe(before);
    });
});
