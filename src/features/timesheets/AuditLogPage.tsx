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
    UserGearIcon,
} from '@phosphor-icons/react';

import { useAuthContext } from '@features/auth/AuthContext';
import { canManageEmployees } from '@shared/auth/permissions';
import { UserProfileModal } from '@features/profile/components/UserProfileModal';
import { type ShiftAuditLog, type ShiftSnapshot, type Profile } from '@shared/types';
import { formatClock, formatDateTime, monthShort } from '@shared/utils/date';
import { timesheetService, type AuditLogQuery } from './timesheetService';
import { useTimesheetRealtime } from './useTimesheetRealtime';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { Select } from '@shared/components/Select';
import type { TranslationKey } from '@shared/i18n/translations';

const PAGE = 50;

type ActionMeta = { labelKey: TranslationKey; Icon: typeof PlusIcon; badge: string };

const ACTION: Record<string, ActionMeta> = {
    create: { labelKey: 'audit.actionAdded', Icon: PlusIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    update: { labelKey: 'audit.actionEdited', Icon: PencilSimpleIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    delete: { labelKey: 'audit.actionDeleted', Icon: TrashIcon, badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
    username_change: { labelKey: 'audit.actionUsername', Icon: AtIcon, badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' },
    name_request_approved: { labelKey: 'audit.actionNameApproved', Icon: CheckCircleIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    name_request_rejected: { labelKey: 'audit.actionNameDeclined', Icon: XCircleIcon, badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
    profile_updated: { labelKey: 'audit.actionProfileUpdated', Icon: UserGearIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
};

const FALLBACK_META: ActionMeta = { labelKey: 'audit.actionGeneric', Icon: ClockCounterClockwiseIcon, badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' };

function memberName(m: Profile): string {
    return [m.first_name, m.last_name].filter(Boolean).join(' ') || m.username;
}

function fmtClock(iso?: string | null): string {
    return formatClock(iso);
}

/** "12 Jun · 09:00–17:00 · Main St" from a stored snapshot. */
function fmtSnapshot(s?: ShiftSnapshot | null): string {
    if (!s || !s.started_at) return '—';
    const d = new Date(s.started_at);
    return `${d.getDate()} ${monthShort(d)} · ${fmtClock(s.started_at)}–${fmtClock(s.ended_at)} · ${s.location_name ?? '—'}`;
}


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
    const t = useTranslation();
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
                    <p className="text-label text-emerald-500 text-left">{t('admin.administration')}</p>
                    <h1 className="text-display text-gray-900 dark:text-white">{t('nav.activity')}</h1>
                </div>
            </header>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <Select size="sm" fullWidth={false} value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}>
                    <option value="">{t('audit.allEmployees')}</option>
                    {members.map((m) => (
                        <option key={m.id} value={m.id}>
                            {memberName(m)}
                        </option>
                    ))}
                </Select>
                <Select size="sm" fullWidth={false} value={action} onChange={(e) => setAction(e.target.value)}>
                    <option value="">{t('audit.allActions')}</option>
                    <option value="create">{t('audit.optAddedShift')}</option>
                    <option value="update">{t('audit.optEditedShift')}</option>
                    <option value="delete">{t('audit.optDeletedShift')}</option>
                    <option value="username_change">{t('audit.optUsername')}</option>
                    <option value="name_request_approved">{t('audit.optNameApproved')}</option>
                    <option value="name_request_rejected">{t('audit.optNameDeclined')}</option>
                </Select>
                <Select size="sm" fullWidth={false} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                    <option value="desc">{t('audit.newest')}</option>
                    <option value="asc">{t('audit.oldest')}</option>
                </Select>
            </div>

            <section className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                    <ClockCounterClockwiseIcon weight="bold" className="w-4 h-4 text-emerald-500" />
                    <h2 className="text-label text-gray-400">{t('audit.shiftChanges')}</h2>
                </div>

                {error ? (
                    <div className="py-16 text-center space-y-1">
                        <p className="text-label text-red-500">{t('state.error')}</p>
                        <p className="text-small text-gray-400">
                            {error instanceof Error ? error.message : t('audit.loadError')}
                        </p>
                    </div>
                ) : isLoading ? (
                    <div className="py-20 text-center text-label text-gray-400 animate-pulse">{t('audit.loading')}</div>
                ) : entries.length === 0 ? (
                    <div className="py-20 text-center text-label text-gray-400">{t('audit.empty')}</div>
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
                                {isFetchingNextPage ? t('common.loading') : t('audit.loadMore')}
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
    const t = useTranslation();
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
                    <p>{t('audit.requested', { name: d.new_name || '—' })}</p>
                    {d.note && <p className="text-gray-400">{t('audit.reason', { note: d.note })}</p>}
                </div>
            );
        default:
            return null;
    }
}

function AuditCard({ entry, onOpenUser }: { entry: ShiftAuditLog; onOpenUser: (userId: string) => void }) {
    const t = useTranslation();
    const meta = ACTION[entry.action] ?? FALLBACK_META;
    const actor = entry.details.actor_name ?? t('audit.someone');
    const target = entry.details.target_name ?? t('audit.member');
    const when = formatDateTime(entry.created_at);

    return (
        <div className="flex gap-3 p-3 rounded-2xl bg-white dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${meta.badge}`}>
                <meta.Icon weight="bold" className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
                {/* Action + who it was about (wraps instead of cramming on mobile). */}
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-body-strong text-gray-900 dark:text-white">
                        {t(meta.labelKey)} ·
                    </span>
                    <PersonButton name={target} userId={entry.target_user_id} onOpenUser={onOpenUser} strong />
                </div>
                {/* Who did it + when — own line so nothing gets squeezed off-screen. */}
                <p className="text-micro text-gray-400">
                    {t('audit.by')} <PersonButton name={actor} userId={entry.actor_id} onOpenUser={onOpenUser} />
                    {' · '}
                    {when}
                </p>

                <AuditBody entry={entry} />
            </div>
        </div>
    );
}
