import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
    PlusIcon,
    PencilSimpleIcon,
    TrashIcon,
    ClockCounterClockwiseIcon,
    ArrowRightIcon,
    CaretRightIcon,
} from '@phosphor-icons/react';

import { useAuthContext } from '@features/auth/AuthContext';
import { canManageEmployees } from '@features/admin/permissions';
import { type ShiftAuditLog, type ShiftSnapshot, type Profile } from '@shared/types';
import { timesheetService, type AuditLogQuery } from './timesheetService';
import { useTimesheetRealtime } from './useTimesheetRealtime';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PAGE = 50;

const ACTION = {
    create: { label: 'Added', Icon: PlusIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    update: { label: 'Edited', Icon: PencilSimpleIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    delete: { label: 'Deleted', Icon: TrashIcon, badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
} as const;

function memberName(m: Profile): string {
    return [m.first_name, m.last_name].filter(Boolean).join(' ') || m.username;
}

function fmtClock(iso?: string | null): string {
    return iso ? new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '…';
}

/** "12 Jun · 09:00–17:00 · Main St" from a stored snapshot. */
function fmtSnapshot(s?: ShiftSnapshot | null): string {
    if (!s || !s.started_at) return '—';
    const d = new Date(s.started_at);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${fmtClock(s.started_at)}–${fmtClock(s.ended_at)} · ${s.location_name ?? 'Unknown'}`;
}

const selectClass =
    'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-small text-gray-700 dark:text-gray-200 outline-none focus:border-emerald-500 transition-colors';

/**
 * --- ACTIVITY LOG PAGE ---
 * Append-only feed of administrative shift changes (create / edit / delete), for
 * Admins and above (rank >= 30). Filter by employee/action, sort, paginate, and
 * click an entry to jump to that member's timesheet. Live via realtime.
 */
export function AuditLogPage() {
    const { user } = useAuthContext();
    if (user && !canManageEmployees(user)) return <Navigate to="/" replace />;
    return <AuditLogInner />;
}

function AuditLogInner() {
    const { user } = useAuthContext();
    const navigate = useNavigate();
    useTimesheetRealtime();

    const [targetUserId, setTargetUserId] = useState<string>('');
    const [action, setAction] = useState<'' | 'create' | 'update' | 'delete'>('');
    const [sort, setSort] = useState<'desc' | 'asc'>('desc');

    const membersQ = useQuery({
        queryKey: ['timesheets', 'members'],
        queryFn: () => timesheetService.getMembers(),
        enabled: !!user,
    });
    const members = membersQ.data ?? [];

    const filters: AuditLogQuery = {
        targetUserId: targetUserId || null,
        action: action || null,
        sort,
    };

    const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['timesheets', 'audit', filters],
        queryFn: ({ pageParam }) => timesheetService.getAuditLog({ ...filters, limit: PAGE, offset: pageParam }),
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => (lastPage.length === PAGE ? allPages.length * PAGE : undefined),
        enabled: !!user,
    });

    const entries = data?.pages.flat() ?? [];

    return (
        <div className="space-y-4 px-1 pb-10">
            <header className="flex items-end justify-between gap-3 pt-2">
                <div className="space-y-0.5">
                    <p className="text-label text-emerald-500 text-left">Administration</p>
                    <h1 className="text-display text-gray-900 dark:text-white">Activity Log</h1>
                </div>
            </header>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} className={selectClass}>
                    <option value="">All employees</option>
                    {members.map((m) => (
                        <option key={m.id} value={m.id}>
                            {memberName(m)}
                        </option>
                    ))}
                </select>
                <select value={action} onChange={(e) => setAction(e.target.value as typeof action)} className={selectClass}>
                    <option value="">All actions</option>
                    <option value="create">Added</option>
                    <option value="update">Edited</option>
                    <option value="delete">Deleted</option>
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={selectClass}>
                    <option value="desc">Newest first</option>
                    <option value="asc">Oldest first</option>
                </select>
            </div>

            <section className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                    <ClockCounterClockwiseIcon weight="bold" className="w-4 h-4 text-emerald-500" />
                    <h2 className="text-label text-gray-400">Shift changes</h2>
                </div>

                {error ? (
                    <div className="py-16 text-center space-y-1">
                        <p className="text-label text-red-500">Something went wrong</p>
                        <p className="text-small text-gray-400">
                            {error instanceof Error ? error.message : 'Failed to load the activity log.'}
                        </p>
                    </div>
                ) : isLoading ? (
                    <div className="py-20 text-center text-label text-gray-400 animate-pulse">Loading activity…</div>
                ) : entries.length === 0 ? (
                    <div className="py-20 text-center text-label text-gray-400">No activity found</div>
                ) : (
                    <>
                        <div className="space-y-2">
                            {entries.map((e) => (
                                <AuditCard
                                    key={e.id}
                                    entry={e}
                                    onOpen={
                                        e.target_user_id
                                            ? () => navigate(`/timesheets?member=${e.target_user_id}`)
                                            : undefined
                                    }
                                />
                            ))}
                        </div>

                        {hasNextPage && (
                            <button
                                onClick={() => fetchNextPage()}
                                disabled={isFetchingNextPage}
                                className="w-full py-2.5 rounded-xl text-label text-emerald-600 dark:text-emerald-400 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                            >
                                {isFetchingNextPage ? 'Loading…' : 'Load more'}
                            </button>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}

function AuditCard({ entry, onOpen }: { entry: ShiftAuditLog; onOpen?: () => void }) {
    const meta = ACTION[entry.action];
    const actor = entry.details.actor_name ?? 'Someone';
    const target = entry.details.target_name ?? 'a member';
    const when = new Date(entry.created_at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div
            onClick={onOpen}
            className={`flex gap-3 p-3 rounded-2xl bg-white dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 shadow-sm transition-colors ${
                onOpen ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5' : ''
            }`}
        >
            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${meta.badge}`}>
                <meta.Icon weight="bold" className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-body-strong text-gray-900 dark:text-white truncate">
                        {meta.label} a shift · {target}
                    </p>
                    <span className="shrink-0 text-micro text-gray-400 whitespace-nowrap">{when}</span>
                </div>
                <p className="text-micro text-gray-400 mt-0.5">by {actor}</p>

                {entry.action === 'update' ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-caption tabular-nums">
                        <span className="text-gray-400 line-through">{fmtSnapshot(entry.details.old)}</span>
                        <ArrowRightIcon weight="bold" className="w-3 h-3 text-gray-300 shrink-0" />
                        <span className="text-gray-700 dark:text-gray-200">{fmtSnapshot(entry.details.new)}</span>
                    </div>
                ) : (
                    <p className="mt-1.5 text-caption tabular-nums text-gray-700 dark:text-gray-200">
                        {fmtSnapshot(entry.action === 'create' ? entry.details.new : entry.details.old)}
                    </p>
                )}
            </div>
            {onOpen && <CaretRightIcon weight="bold" className="w-4 h-4 text-gray-300 self-center shrink-0" />}
        </div>
    );
}
