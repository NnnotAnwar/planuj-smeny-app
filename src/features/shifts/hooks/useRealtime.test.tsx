import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Shift, ShiftWithProfile, User } from '@shared/types';
import { shiftKeys } from '../shiftKeys';

// --- A fake realtime channel that records its handlers -------------------
type Handler = (payload: { eventType: string; new: unknown; old: unknown }) => void;
const channels: { handlers: Record<string, Handler>; status: (s: string) => void }[] = [];
const removeChannel = vi.fn();

vi.mock('@shared/api/supabaseClient', () => ({
    supabase: {
        channel: () => {
            const ch = { handlers: {} as Record<string, Handler>, status: (() => {}) as (s: string) => void };
            const api = {
                on: (_type: string, cfg: { table: string }, fn: Handler) => {
                    ch.handlers[cfg.table] = fn;
                    return api;
                },
                subscribe: (cb: (s: string) => void) => {
                    ch.status = cb;
                    channels.push(ch);
                    return api;
                },
            };
            return api;
        },
        removeChannel: (c: unknown) => removeChannel(c),
    },
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }));

import { useShiftRealtime } from './useRealtime';

const user: User = {
    id: 'u1', username: 'alice', first_name: 'Alice', last_name: 'A', email: 'a@x.io',
    role: { name: 'Employee', is_admin: false, rank: 0 }, organization_id: 'org1',
};
const activeKey = shiftKeys.active(user.id);
const boardKey = shiftKeys.board(user.organization_id);

const shift = (over: Partial<Shift>): Shift => ({
    id: 's1', user_id: 'u1', location_id: 'loc1', previous_location_id: null, organization_id: 'org1',
    started_at: '2026-11-06T08:00:00Z', ended_at: null, role: 'Employee', ...over,
});
const onBoard = (s: Shift): ShiftWithProfile => ({ ...s, profiles: { username: 'x', first_name: 'X', last_name: null } });

function setup() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const live = shift({ id: 'live' });
    qc.setQueryData(activeKey, live);
    qc.setQueryData(boardKey, [onBoard(live), onBoard(shift({ id: 'bob-live', user_id: 'u2' }))]);
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const hook = renderHook(() => useShiftRealtime(user), { wrapper });
    const ch = channels[channels.length - 1];
    const emit = (eventType: string, row: Partial<Shift>, old: unknown = {}) => ch.handlers.shifts({ eventType, new: row, old });
    return { qc, invalidate, emit, ch, hook };
}

beforeEach(() => {
    channels.length = 0;
    removeChannel.mockClear();
});

describe('useShiftRealtime', () => {
    it('REGRESSION: an admin editing a PAST shift of mine does not end my live shift', () => {
        const { qc, emit } = setup();
        emit('UPDATE', shift({ id: 'old-one', ended_at: '2026-11-01T16:00:00Z' }));
        expect(qc.getQueryData<Shift>(activeKey)?.id).toBe('live');
    });

    it('ending my live shift clears the active card and drops it from the board', () => {
        const { qc, emit, invalidate } = setup();
        emit('UPDATE', shift({ id: 'live', ended_at: '2026-11-06T16:00:00Z' }));
        expect(qc.getQueryData(activeKey)).toBeNull();
        expect(qc.getQueryData<ShiftWithProfile[]>(boardKey)?.map((s) => s.id)).toEqual(['bob-live']);
        expect(invalidate).toHaveBeenCalledWith({ queryKey: shiftKeys.history(user.id) });
    });

    it("a colleague clocking out leaves my active shift alone and updates the board", () => {
        const { qc, emit } = setup();
        emit('UPDATE', shift({ id: 'bob-live', user_id: 'u2', ended_at: '2026-11-06T16:00:00Z' }));
        expect(qc.getQueryData<Shift>(activeKey)?.id).toBe('live');
        expect(qc.getQueryData<ShiftWithProfile[]>(boardKey)?.map((s) => s.id)).toEqual(['live']);
    });

    it('a location switch on an open shift merges into the board, keeping the profile', () => {
        const { qc, emit } = setup();
        emit('UPDATE', shift({ id: 'bob-live', user_id: 'u2', location_id: 'loc2' }));
        const bob = qc.getQueryData<ShiftWithProfile[]>(boardKey)?.find((s) => s.id === 'bob-live');
        expect(bob?.location_id).toBe('loc2');
        expect(bob?.profiles?.first_name).toBe('X');
    });

    it('a delete removes the row everywhere (matched by id only)', () => {
        const { qc, emit } = setup();
        emit('DELETE', {}, { id: 'live' });
        expect(qc.getQueryData(activeKey)).toBeNull();
        expect(qc.getQueryData<ShiftWithProfile[]>(boardKey)?.map((s) => s.id)).toEqual(['bob-live']);
    });

    it('an insert refetches (needs joined data), mine also refetches the active card', () => {
        const { emit, invalidate } = setup();
        emit('INSERT', shift({ id: 'new', user_id: 'u2' }));
        expect(invalidate).toHaveBeenCalledWith({ queryKey: boardKey });
        expect(invalidate).not.toHaveBeenCalledWith({ queryKey: activeKey });
        emit('INSERT', shift({ id: 'new2' }));
        expect(invalidate).toHaveBeenCalledWith({ queryKey: activeKey });
    });

    describe('reconnect', () => {
        beforeEach(() => vi.useFakeTimers());
        afterEach(() => vi.useRealTimers());

        it('backs off exponentially after a channel error and resets once subscribed', () => {
            const { ch, hook } = setup();
            ch.status('CHANNEL_ERROR');
            vi.advanceTimersByTime(999);
            expect(channels).toHaveLength(1);
            vi.advanceTimersByTime(1);
            expect(channels).toHaveLength(2); // retried after 1 s
            expect(removeChannel).toHaveBeenCalledTimes(1);

            channels[1].status('TIMED_OUT');
            vi.advanceTimersByTime(1999);
            expect(channels).toHaveLength(2);
            vi.advanceTimersByTime(1);
            expect(channels).toHaveLength(3); // then after 2 s

            hook.unmount();
            channels[2].status('CHANNEL_ERROR');
            vi.advanceTimersByTime(60_000);
            expect(channels).toHaveLength(3); // no retry once unmounted
        });
    });
});
