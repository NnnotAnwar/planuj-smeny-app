import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { User } from '@shared/types';

// --- Mocks: every data source of the inbox --------------------------------
const me: User = {
    id: 'me', username: 'boss', first_name: 'Boss', last_name: null, email: 'b@x.io', organization_id: 'org1',
    role: { name: 'Head Admin', is_admin: true, rank: 40 },
};
vi.mock('@shared/api/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/shared/api/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuthContext: () => ({ user: me }) }));
vi.mock('@features/auth/AuthContext', () => ({ useAuthContext: () => ({ user: me }) }));
vi.mock('@shared/preferences/PreferencesContext', () => ({ useTranslation: () => (k: string) => k }));
vi.mock('@shared/toast/toastStore', () => ({ toast: vi.fn() }));
vi.mock('./requestsService', () => ({
    requestsService: {
        getTimeOff: vi.fn(async () => [
            { id: 't1', user_id: 'ann', organization_id: 'org1', kind: 'vacation', starts_on: '2026-12-01', ends_on: '2026-12-02', status: 'pending', note: null, created_at: '2026-11-01T00:00:00Z', profiles: { first_name: 'Ann', last_name: null, username: 'ann' } },
            { id: 't2', user_id: 'me', organization_id: 'org1', kind: 'sick', starts_on: '2026-12-05', ends_on: '2026-12-05', status: 'pending', note: null, created_at: '2026-11-02T00:00:00Z', profiles: { first_name: 'Boss', last_name: null, username: 'boss' } },
        ]),
        getNameRequests: vi.fn(async () => []),
    },
}));
vi.mock('@features/schedule/swaps/swapService', () => ({
    swapService: { list: vi.fn(async () => []), review: vi.fn(), withdraw: vi.fn() },
    swapBlockReason: () => null,
}));
vi.mock('./memberRequestsService', async (orig) => {
    const real = await orig<typeof import('./memberRequestsService')>();
    return {
        ...real,
        memberRequestsService: {
            list: vi.fn(async () => [
                { id: 'r1', organization_id: 'org1', user_id: 'ann', person_name: 'Ann', kind: 'role', subject: null, body: 'pls', org_role_id: 'role-sup', role_name: 'Supervisor', role_color: '#000', current_role_name: 'Employee', anonymous: false, status: 'pending', review_note: null, reviewer_name: null, reviewed_at: null, created_at: '2026-11-03T00:00:00Z', mine: false, can_review: true },
                { id: 'c1', organization_id: 'org1', user_id: null, person_name: null, kind: 'complaint', subject: 'Noise', body: 'Loud', org_role_id: null, role_name: null, role_color: null, current_role_name: null, anonymous: true, status: 'pending', review_note: null, reviewer_name: null, reviewed_at: null, created_at: '2026-11-04T00:00:00Z', mine: false, can_review: true },
            ]),
            review: vi.fn(),
            cancel: vi.fn(),
            submit: vi.fn(),
        },
    };
});
vi.mock('@features/schedule/scheduleService', () => ({
    scheduleService: { reviewTimeOff: vi.fn(), deleteTimeOff: vi.fn(), getRange: vi.fn(async () => []) },
}));
vi.mock('@features/admin/adminService', () => ({ adminService: { reviewNameChange: vi.fn() } }));

import { useRequests } from './useRequests';
import { memberRequestsService } from './memberRequestsService';
import { scheduleService } from '@features/schedule/scheduleService';
import { toast } from '@shared/toast/toastStore';

function setup() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    return renderHook(() => useRequests(), { wrapper });
}

beforeEach(() => vi.clearAllMocks());

describe('useRequests — the shared inbox', () => {
    it('queues every pending request oldest first — my own included — and lists mine separately', async () => {
        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.toReview.map((i) => i.key)).toEqual(['timeoff:t1', 'timeoff:t2', 'role:r1', 'complaint:c1']);
        expect(result.current.mine.map((i) => i.key)).toEqual(['timeoff:t2']);
    });

    it('an anonymous complaint carries no sender', async () => {
        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        const c = result.current.toReview.find((i) => i.type === 'complaint')!;
        expect(c.userId).toBe('');
        expect(c.personName).toBe('');
        expect(c.anonymous).toBe(true);
    });

    it('routes a decision to the right service', async () => {
        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        const [leave, , role] = result.current.toReview;
        await act(() => result.current.decide.mutateAsync({ item: role, approve: true, note: '  ok  ' }));
        expect(memberRequestsService.review).toHaveBeenCalledWith('r1', true, 'ok');
        await act(() => result.current.decide.mutateAsync({ item: leave, approve: false, note: 'busy' }));
        expect(scheduleService.reviewTimeOff).toHaveBeenCalledWith('t1', false, 'me', 'busy');
        expect(toast).toHaveBeenLastCalledWith('requests.declined', 'success');
    });

    it('turns a server error code into a friendly message', async () => {
        vi.mocked(memberRequestsService.review).mockRejectedValueOnce(new Error('request_role_gone'));
        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        const role = result.current.toReview.find((i) => i.type === 'role')!;
        await act(async () => {
            await result.current.decide.mutateAsync({ item: role, approve: true }).catch(() => {});
        });
        expect(toast).toHaveBeenLastCalledWith('mreq.err.request_role_gone', 'error');
    });

    it('withdraws a member request through its own RPC, leave through time off', async () => {
        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        const complaint = result.current.toReview.find((i) => i.type === 'complaint')!;
        await act(() => result.current.withdraw.mutateAsync(complaint));
        expect(memberRequestsService.cancel).toHaveBeenCalledWith('c1');
        await act(() => result.current.withdraw.mutateAsync(result.current.mine[0]));
        expect(scheduleService.deleteTimeOff).toHaveBeenCalledWith('t2');
    });
});
