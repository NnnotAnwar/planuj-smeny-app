import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Shift, ShiftWithProfile, User } from '@shared/types';
import { shiftKeys } from '../shiftKeys';

// --- Mocks ---------------------------------------------------------------
vi.mock('../shiftService', () => ({
    shiftService: {
        startShift: vi.fn(),
        endShift: vi.fn(),
        changeShiftLocation: vi.fn(),
    },
}));
vi.mock('@shared/toast/toastStore', () => ({ toast: vi.fn() }));

import { shiftService } from '../shiftService';
import { toast } from '@shared/toast/toastStore';
import { useShiftMutations } from './useShiftMutations';

const user: User = {
    id: 'u1',
    username: 'alice',
    first_name: 'Alice',
    last_name: 'A',
    email: 'a@x.io',
    role: { name: 'Employee', is_admin: false, rank: 0 },
    organization_id: 'org1',
};

const boardKey = shiftKeys.board(user.organization_id);
const activeKey = shiftKeys.active(user.id);

const ownShift: ShiftWithProfile = {
    id: 's-own', user_id: 'u1', location_id: 'loc1', previous_location_id: null,
    organization_id: 'org1', started_at: '2026-01-01T08:00:00Z', ended_at: null,
    role: 'Employee', profiles: { username: 'alice', first_name: 'Alice', last_name: 'A' },
};
const otherShift: ShiftWithProfile = {
    id: 's-other', user_id: 'u2', location_id: 'loc1', previous_location_id: null,
    organization_id: 'org1', started_at: '2026-01-01T09:00:00Z', ended_at: null,
    role: 'Employee', profiles: { username: 'bob', first_name: 'Bob', last_name: 'B' },
};

function setup(seed: (qc: QueryClient) => void) {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
    seed(qc);
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useShiftMutations(user), { wrapper });
    return { qc, result };
}

beforeEach(() => vi.clearAllMocks());

describe('useShiftMutations', () => {
    it('startShift optimistically adds the worker to the board', async () => {
        const { qc, result } = setup((c) => c.setQueryData(boardKey, [otherShift]));
        vi.mocked(shiftService.startShift).mockReturnValue(new Promise(() => {})); // never resolves

        act(() => result.current.startShift.mutate('loc1'));

        await waitFor(() => {
            const board = qc.getQueryData<ShiftWithProfile[]>(boardKey)!;
            expect(board).toHaveLength(2);
            expect(board.some((s) => s.user_id === 'u1' && s.location_id === 'loc1')).toBe(true);
        });
    });

    it('startShift rolls the board back and toasts on error', async () => {
        const { qc, result } = setup((c) => c.setQueryData(boardKey, [otherShift]));
        vi.mocked(shiftService.startShift).mockRejectedValue(new Error('RLS denied'));

        await act(async () => {
            await result.current.startShift.mutateAsync('loc1').catch(() => {});
        });

        expect(qc.getQueryData<ShiftWithProfile[]>(boardKey)).toEqual([otherShift]);
        expect(toast).toHaveBeenCalledWith('RLS denied');
    });

    it('endShift optimistically removes the shift and clears the active cache', async () => {
        const { qc, result } = setup((c) => {
            c.setQueryData(boardKey, [ownShift, otherShift]);
            c.setQueryData(activeKey, ownShift as Shift);
        });
        vi.mocked(shiftService.endShift).mockReturnValue(new Promise(() => {}));

        act(() => result.current.endShift.mutate('s-own'));

        await waitFor(() => {
            expect(qc.getQueryData<ShiftWithProfile[]>(boardKey)).toEqual([otherShift]);
            expect(qc.getQueryData(activeKey)).toBeNull();
        });
    });

    it('changeLocation rolls active + board back on error', async () => {
        const { qc, result } = setup((c) => {
            c.setQueryData(boardKey, [ownShift]);
            c.setQueryData(activeKey, ownShift as Shift);
        });
        vi.mocked(shiftService.changeShiftLocation).mockRejectedValue(new Error('nope'));

        await act(async () => {
            await result.current.changeLocation
                .mutateAsync({ shiftId: 's-own', newLocationId: 'loc2', previousLocationId: 'loc1' })
                .catch(() => {});
        });

        expect(qc.getQueryData<Shift>(activeKey)).toEqual(ownShift);
        expect((qc.getQueryData<ShiftWithProfile[]>(boardKey))![0].location_id).toBe('loc1');
        expect(toast).toHaveBeenCalledWith('nope');
    });
});
