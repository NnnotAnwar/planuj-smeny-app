import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
    PlusIcon,
    PencilSimpleIcon,
    TrashIcon,
    ClockCounterClockwiseIcon,
    ArrowRightIcon,
    AtIcon,
    CheckCircleIcon,
    XCircleIcon,
} from '@phosphor-icons/react';

import { useAuthContext } from '@features/auth/AuthContext';
import { canManageEmployees } from '@shared/auth/permissions';
import { UserProfileModal } from '@features/profile/components/UserProfileModal';
import { type ShiftAuditLog, type ShiftSnapshot, type Profile } from '@shared/types';
import { timesheetService, type AuditLogQuery } from './timesheetService';
import { useTimesheetRealtime } from './useTimesheetRealtime';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PAGE = 50;

type ActionMeta = { label: string; Icon: typeof PlusIcon; badge: string; noun?: string };

const ACTION: Record<string, ActionMeta> = {
    create: { label: 'Added', noun: 'shift', Icon: PlusIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    update: { label: 'Edited', noun: 'shift', Icon: PencilSimpleIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    delete: { label: 'Deleted', noun: 'shift', Icon: TrashIcon, badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
    username_change: { label: 'Changed username', Icon: AtIcon, badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' },
    name_request_approved: { label: 'Approved name change', Icon: CheckCircleIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    name_request_rejected: { label: 'Declined name change', Icon: XCircleIcon, badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
};

const FALLBACK_META: ActionMeta = { label: 'Activity', Icon: ClockCounterClockwiseIcon, badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' };

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
    useTimesheetRealtime();

    const [targetUserId, setTargetUserId] = useState<string>('');
    const [action, setAction] = useState<string>('');
    const [sort, setSort] = useState<'desc' | 'asc'>('desc');
    // Which person's profile modal is open (from tapping a name in a log entry).
    const [profileUserId, setProfileUserId] = useState<string | null>(null);

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
                <select value={action} onChange={(e) => setAction(e.target.value)} className={selectClass}>
                    <option value="">All actions</option>
                    <option value="create">Added shift</option>
                    <option value="update">Edited shift</option>
                    <option value="delete">Deleted shift</option>
                    <option value="username_change">Username changed</option>
                    <option value="name_request_approved">Name approved</option>
                    <option value="name_request_rejected">Name declined</option>
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
                                <AuditCard key={e.id} entry={e} onOpenUser={setProfileUserId} />
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

            {profileUserId && (
                <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
            )}
        </div>
    );
}

/**
 * A name that opens the person's profile modal when we know their user id.
 * Clickable names are styled as emerald links (underlined) so it's obvious they
 * can be tapped; unknown actors fall back to plain text.
 */
function PersonButton({ name, userId, onOpenUser, strong = false }: {
    name: string;
    userId: string | null;
    onOpenUser: (userId: string) => void;
    strong?: boolean;
}) {
    const size = strong ? 'text-body-strong' : '';
    if (!userId) {
        return <span className={`${size} ${strong ? 'text-gray-900 dark:text-white' : ''}`}>{name}</span>;
    }
    return (
        <button
            type="button"
            onClick={() => onOpenUser(userId)}
            className={`${size} text-emerald-600 dark:text-emerald-400 font-semibold underline decoration-emerald-400/50 underline-offset-2 hover:decoration-emerald-500 transition-colors`}
        >
            {name}
        </button>
    );
}

/** Stacked-on-mobile, inline-on-desktop "old → new" diff row. */
function DiffRow({ before, after, beforeStrike = true }: { before: string; after: string; beforeStrike?: boolean }) {
    return (
        <div className="text-caption tabular-nums space-y-0.5 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
            <span className={`block sm:inline text-gray-400 ${beforeStrike ? 'line-through' : ''}`}>{before}</span>
            <ArrowRightIcon weight="bold" className="hidden sm:block w-3 h-3 text-gray-300 shrink-0" />
            <span className="block sm:inline text-gray-700 dark:text-gray-200">{after}</span>
        </div>
    );
}

function AuditBody({ entry }: { entry: ShiftAuditLog }) {
    const d = entry.details;
    switch (entry.action) {
        case 'update':
            return <DiffRow before={fmtSnapshot(d.old)} after={fmtSnapshot(d.new)} />;
        case 'create':
        case 'delete':
            return (
                <p className="text-caption tabular-nums text-gray-700 dark:text-gray-200">
                    {fmtSnapshot(entry.action === 'create' ? d.new : d.old)}
                </p>
            );
        case 'username_change':
            return <DiffRow before={`@${d.old_username ?? '—'}`} after={`@${d.new_username ?? '—'}`} />;
        case 'name_request_approved':
            return <DiffRow before={d.old_name || '—'} after={d.new_name || '—'} />;
        case 'name_request_rejected':
            return (
                <div className="text-caption text-gray-700 dark:text-gray-200 space-y-0.5">
                    <p>Requested: <span className="text-gray-500 dark:text-gray-400">{d.new_name || '—'}</span></p>
                    {d.note && <p className="text-gray-400">Reason: {d.note}</p>}
                </div>
            );
        default:
            return null;
    }
}

function AuditCard({ entry, onOpenUser }: { entry: ShiftAuditLog; onOpenUser: (userId: string) => void }) {
    const meta = ACTION[entry.action] ?? FALLBACK_META;
    const actor = entry.details.actor_name ?? 'Someone';
    const target = entry.details.target_name ?? 'a member';
    const when = new Date(entry.created_at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div className="flex gap-3 p-3 rounded-2xl bg-white dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${meta.badge}`}>
                <meta.Icon weight="bold" className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
                {/* Action + who it was about (wraps instead of cramming on mobile). */}
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-body-strong text-gray-900 dark:text-white">
                        {meta.label}{meta.noun ? ` a ${meta.noun}` : ''} ·
                    </span>
                    <PersonButton name={target} userId={entry.target_user_id} onOpenUser={onOpenUser} strong />
                </div>
                {/* Who did it + when — own line so nothing gets squeezed off-screen. */}
                <p className="text-micro text-gray-400">
                    by <PersonButton name={actor} userId={entry.actor_id} onOpenUser={onOpenUser} />
                    {' · '}
                    {when}
                </p>

                <AuditBody entry={entry} />
            </div>
        </div>
    );
}
