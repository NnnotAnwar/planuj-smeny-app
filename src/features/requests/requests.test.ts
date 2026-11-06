import { describe, expect, it, vi } from 'vitest';

// Pure logic under test — keep the real Supabase client (and its session restore) out.
vi.mock('@shared/api/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/shared/api/supabaseClient', () => ({ supabase: {} }));
import { RANK } from '@shared/auth/permissions';
import type { User } from '@shared/types';
import { canDecideOn } from './useRequests';
import type { RequestItem } from './types';

const mkUser = (rank: number, id = 'me', name = 'Head Admin'): User =>
    ({ id, username: id, first_name: null, last_name: null, email: 'a@b.c', organization_id: 'org1', role: { name, is_admin: rank >= RANK.ADMIN, rank } }) as User;

const item = (over: Partial<RequestItem> = {}): RequestItem => ({
    key: 'timeoff:1',
    type: 'timeoff',
    id: '1',
    userId: 'someone',
    personName: 'Someone',
    status: 'pending',
    createdAt: '2026-11-06T10:00:00Z',
    reviewedAt: null,
    reviewNote: null,
    note: null,
    ...over,
});

describe('who decides a request', () => {
    it('never the person who asked — not even the Head Admin or a Superadmin', () => {
        expect(canDecideOn(mkUser(RANK.OWNER), item({ userId: 'me' }))).toBe(false);
        expect(canDecideOn(mkUser(100, 'me', 'Superadmin'), item({ userId: 'me' }))).toBe(false);
    });

    it('never the colleague taking the shift in a swap', () => {
        expect(canDecideOn(mkUser(RANK.OWNER), item({ type: 'swap', takerId: 'me' }))).toBe(false);
    });

    it('someone else with the right to decide', () => {
        expect(canDecideOn(mkUser(RANK.OWNER), item())).toBe(true);
    });

    it('follows the server for role / other / complaint requests', () => {
        expect(canDecideOn(mkUser(RANK.OWNER), item({ type: 'complaint', canReview: false }))).toBe(false);
        expect(canDecideOn(mkUser(RANK.OWNER), item({ type: 'role', canReview: true }))).toBe(true);
    });
});
