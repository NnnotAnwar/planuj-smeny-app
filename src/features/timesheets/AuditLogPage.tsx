import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    PlusIcon,
    PencilSimpleIcon,
    TrashIcon,
    ClockCounterClockwiseIcon,
    ArrowRightIcon,
} from '@phosphor-icons/react';

import { useAuthContext } from '@features/auth/AuthContext';
import { canManageEmployees } from '@features/admin/permissions';
import { type ShiftAuditLog, type ShiftSnapshot } from '@shared/types';
import { timesheetService } from './timesheetService';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ACTION = {
    create: { label: 'Added', Icon: PlusIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    update: { label: 'Edited', Icon: PencilSimpleIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    delete: { label: 'Deleted', Icon: TrashIcon, badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
} as const;

function fmtClock(iso?: string | null): string {
    return iso ? new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '…';
}

/** "12 Jun · 09:00–17:00 · Main St" from a stored snapshot. */
function fmtSnapshot(s?: ShiftSnapshot | null): string {
    if (!s || !s.started_at) return '—';
    const d = new Date(s.started_at);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${fmtClock(s.started_at)}–${fmtClock(s.ended_at)} · ${s.location_name ?? 'Unknown'}`;
}

/**
 * --- ACTIVITY LOG PAGE ---
 * An append-only feed of administrative shift changes (create / edit / delete),
 * for Admins and above (rank >= 30). Each entry snapshots who did what to whom,
 * with before/after values so it stays readable after the shift is gone.
 */
export function AuditLogPage() {
    const { user } = useAuthContext();
    if (user && !canManageEmployees(user)) return <Navigate to="/" replace />;
    return <AuditLogInner />;
}

function AuditLogInner() {
    const { user } = useAuthContext();
    const { data, isLoading, error } = useQuery({
        queryKey: ['timesheets', 'audit'],
        queryFn: () => timesheetService.getAuditLog(),
        enabled: !!user,
    });

    const entries = data ?? [];

    return (
        <div className="space-y-4 px-1 pb-10">
            <header className="flex items-end justify-between gap-3 pt-2">
                <div className="space-y-0.5">
                    <p className="text-label text-emerald-500 text-left">Administration</p>
                    <h1 className="text-display text-gray-900 dark:text-white">Activity Log</h1>
                </div>
                {entries.length > 0 && (
                    <span className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm text-xs font-black text-emerald-600 dark:text-emerald-400">
                        {entries.length}
                    </span>
                )}
            </header>

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
                    <div className="py-20 text-center text-label text-gray-400">No activity yet</div>
                ) : (
                    <div className="space-y-2">
                        {entries.map((e) => (
                            <AuditCard key={e.id} entry={e} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function AuditCard({ entry }: { entry: ShiftAuditLog }) {
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
        <div className="flex gap-3 p-3 rounded-2xl bg-white dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 shadow-sm">
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
        </div>
    );
}
