import { useMemo, useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '@/features/auth/AuthContext';
import { can, isSuperAdmin, RANK } from '@shared/auth/permissions';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { toast } from '@shared/toast/toastStore';
import type { NameChangeRequest, TimeOff, User } from '@shared/types';
import { scheduleService } from '@features/schedule/scheduleService';
import { adminService } from '@features/admin/adminService';
import { leaveErr } from '@features/schedule/timeOffShared';
import { requestsService } from './requestsService';
import { swapBlockReason, swapService } from '@features/schedule/swaps/swapService';
import { swapKeys } from '@features/schedule/swaps/useShiftSwaps';
import { personName, type ShiftSwap } from '@features/schedule/swaps/types';
import type { RequestItem } from './types';

/**
 * --- useRequests ---
 * The shared inbox: time off + name changes, normalised into one list and
 * split into what's waiting, what was decided (last 30 days) and the user's
 * own. Who may decide follows permissions.ts — admins decide, managers only
 * observe, and nobody decides on their own request (except the Head Admin,
 * who has nobody above them; RLS enforces the same).
 */

const fullName = (p: { first_name?: string | null; last_name?: string | null; username?: string } | null | undefined) =>
    [p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.username || '—';

const fromTimeOff = (e: TimeOff): RequestItem => ({
    key: `timeoff:${e.id}`,
    type: 'timeoff',
    id: e.id,
    userId: e.user_id,
    personName: fullName(e.profiles),
    status: e.status,
    createdAt: e.created_at,
    reviewedAt: e.reviewed_at ?? null,
    reviewNote: e.review_note ?? null,
    note: e.note ?? null,
    kind: e.kind,
    startsOn: e.starts_on,
    endsOn: e.ends_on,
});

const fromName = (r: NameChangeRequest): RequestItem => ({
    key: `name:${r.id}`,
    type: 'name',
    id: r.id,
    userId: r.user_id,
    personName: fullName(r.requester),
    status: r.status === 'rejected' ? 'declined' : r.status,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at ?? null,
    reviewNote: r.review_note ?? null,
    note: r.note ?? null,
    oldName: [r.current_first_name, r.current_last_name].filter(Boolean).join(' ') || '—',
    newName: [r.requested_first_name, r.requested_last_name].filter(Boolean).join(' ') || '—',
});

/** A swap is a request once someone took it; open offers live on the Schedule. */
const fromSwap = (w: ShiftSwap): RequestItem | null => {
    if (!w.shift || (w.status !== 'taken' && w.status !== 'approved' && w.status !== 'declined')) return null;
    return {
        key: `swap:${w.id}`,
        type: 'swap',
        id: w.id,
        userId: w.from_user,
        personName: personName(w.from),
        status: w.status === 'taken' ? 'pending' : w.status,
        createdAt: w.updated_at,
        reviewedAt: w.reviewed_at ?? null,
        reviewNote: w.review_note ?? null,
        note: w.note ?? null,
        takerId: w.taker_id ?? null,
        takerName: personName(w.taker),
        shiftStart: w.shift.starts_at,
        shiftEnd: w.shift.ends_at,
        shiftAllDay: w.shift.all_day,
        locationName: w.shift.location?.name ?? '',
    };
};

export const requestKeys = {
    timeOff: ['time-off', 'requests'] as const,
    names: ['requests', 'names'] as const,
};

/** Whether `user` may decide on `item` (mirrors can_review_request in the DB). */
export function canDecideOn(user: User | null, item: RequestItem): boolean {
    if (!user || !can(user, 'requests.decide')) return false;
    const involved = item.userId === user.id || item.takerId === user.id;
    return !involved || isSuperAdmin(user) || user.role.rank >= RANK.OWNER;
}

function useRequestQueries(user: User | null) {
    const timeOffQ = useQuery({ queryKey: requestKeys.timeOff, queryFn: requestsService.getTimeOff, enabled: !!user });
    const namesQ = useQuery({ queryKey: requestKeys.names, queryFn: requestsService.getNameRequests, enabled: !!user });
    const swapsQ = useQuery({ queryKey: swapKeys.all, queryFn: swapService.list, enabled: !!user });
    const items = useMemo(
        () => [
            ...(timeOffQ.data ?? []).map(fromTimeOff),
            ...(namesQ.data ?? []).map(fromName),
            ...(swapsQ.data ?? []).map(fromSwap).filter((i): i is RequestItem => !!i),
        ],
        [timeOffQ.data, namesQ.data, swapsQ.data],
    );
    return {
        items,
        isLoading: timeOffQ.isLoading || namesQ.isLoading || swapsQ.isLoading,
        error: timeOffQ.error ?? namesQ.error ?? swapsQ.error,
    };
}

export function useRequests() {
    const { user } = useAuthContext();
    const t = useTranslation();
    const qc = useQueryClient();
    const { items, isLoading, error } = useRequestQueries(user);
    const me = user?.id;
    // Mount-time clock for the 30-day history window (no need to tick).
    const [now] = useState(() => Date.now());

    const { toReview, history, mine } = useMemo(() => {
        const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
        const decidedAt = (i: RequestItem) => new Date(i.reviewedAt ?? i.createdAt).getTime();
        return {
            // Oldest first: a fair queue.
            toReview: items
                .filter((i) => i.status === 'pending' && i.userId !== me && i.takerId !== me)
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
            history: items
                .filter((i) => i.status !== 'pending' && decidedAt(i) >= monthAgo)
                .sort((a, b) => decidedAt(b) - decidedAt(a)),
            mine: items.filter((i) => i.userId === me || i.takerId === me).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        };
    }, [items, me, now]);

    // Planned shifts that approving a leave would remove (a DB trigger clears
    // the member's rota shifts on approved leave days) — one fetch for all.
    const pendingLeave = toReview.filter((i) => i.type === 'timeoff');
    const range = pendingLeave.length
        ? {
              from: pendingLeave.reduce((m, i) => (i.startsOn! < m ? i.startsOn! : m), pendingLeave[0].startsOn!),
              to: pendingLeave.reduce((m, i) => (i.endsOn! > m ? i.endsOn! : m), pendingLeave[0].endsOn!),
          }
        : null;
    const rotaQ = useQuery({
        queryKey: ['schedule', 'request-conflicts', range?.from, range?.to],
        enabled: !!range && can(user, 'team.view'),
        queryFn: () => {
            const [fy, fm, fd] = range!.from.split('-').map(Number);
            const [ty, tm, td] = range!.to.split('-').map(Number);
            return scheduleService.getRange(new Date(fy, fm - 1, fd).toISOString(), new Date(ty, tm - 1, td + 1).toISOString());
        },
    });
    const conflictsFor = (item: RequestItem): number => {
        if (item.type !== 'timeoff' || !rotaQ.data) return 0;
        const [fy, fm, fd] = item.startsOn!.split('-').map(Number);
        const [ty, tm, td] = item.endsOn!.split('-').map(Number);
        const start = new Date(fy, fm - 1, fd).getTime();
        const end = new Date(ty, tm - 1, td + 1).getTime();
        return rotaQ.data.filter((s) => s.user_id === item.userId && new Date(s.starts_at).getTime() >= start && new Date(s.starts_at).getTime() < end).length;
    };

    const refresh = () => {
        qc.invalidateQueries({ queryKey: ['time-off'] });
        qc.invalidateQueries({ queryKey: ['requests'] });
        // An approved name change renames the member on the Team page too.
        qc.invalidateQueries({ queryKey: ['admin'] });
        // Approved leave removes rota shifts on those days.
        qc.invalidateQueries({ queryKey: ['schedule'] });
        // An approved swap moves the shift to the taker.
        qc.invalidateQueries({ queryKey: swapKeys.all });
    };

    const decide = useMutation({
        mutationFn: async ({ item, approve, note }: { item: RequestItem; approve: boolean; note?: string | null }) => {
            if (!user) throw new Error('Not signed in.');
            if (item.type === 'timeoff') await scheduleService.reviewTimeOff(item.id, approve, user.id, note);
            else if (item.type === 'swap') await swapService.review(item.id, approve, note?.trim() || null);
            else await adminService.reviewNameChange(item.id, approve, note?.trim() || null);
        },
        onSuccess: (_d, v) => {
            refresh();
            toast(v.approve ? t('requests.approved') : t('requests.declined'), 'success');
        },
        onError: (e) => {
            const blocked = swapBlockReason(e);
            toast(blocked ? t(`swap.blocked_${blocked}` as 'swap.blocked_busy') : leaveErr(e, t) || t('requests.error'), 'error');
        },
    });

    const withdraw = useMutation({
        mutationFn: (item: RequestItem) => (item.type === 'swap' ? swapService.withdraw(item.id) : scheduleService.deleteTimeOff(item.id)),
        onSuccess: refresh,
        onError: () => toast(t('requests.error'), 'error'),
    });

    return { user, toReview, history, mine, isLoading, error, conflictsFor, decide, withdraw };
}

// --- "seen" marker for decisions on your own requests (per device) -----------

const seenKey = (uid: string) => `requests:seen:${uid}`;
const seenListeners = new Set<() => void>();

function readSeen(uid: string | undefined): number {
    if (!uid) return 0;
    try {
        return Number(localStorage.getItem(seenKey(uid)) ?? 0) || 0;
    } catch {
        return 0;
    }
}

/** Call when the user has looked at their requests: clears the decision badge. */
export function markRequestsSeen(uid: string) {
    try {
        localStorage.setItem(seenKey(uid), String(Date.now()));
    } catch {
        /* storage unavailable — the badge simply stays */
    }
    seenListeners.forEach((l) => l());
}

/**
 * Nav badge: deciders see how many requests wait for them; everyone else sees
 * decisions on their own requests they haven't looked at yet.
 */
export function useRequestsBadge(): number {
    const { user } = useAuthContext();
    const { items } = useRequestQueries(user);
    const seen = useSyncExternalStore(
        (cb) => {
            seenListeners.add(cb);
            return () => seenListeners.delete(cb);
        },
        () => readSeen(user?.id),
    );
    if (!user) return 0;
    if (can(user, 'requests.decide')) return items.filter((i) => i.status === 'pending' && canDecideOn(user, i)).length;
    return items.filter(
        (i) => (i.userId === user.id || i.takerId === user.id) && i.status !== 'pending' && i.reviewedAt && new Date(i.reviewedAt).getTime() > seen,
    ).length;
}
