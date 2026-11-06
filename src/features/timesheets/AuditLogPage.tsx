import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
    PlusIcon,
    PencilSimpleIcon,
    TrashIcon,
    ClockCounterClockwiseIcon,
    ClockCountdownIcon,
    ArrowRightIcon,
    AtIcon,
    CheckCircleIcon,
    XCircleIcon,
    UserGearIcon,
    PaperPlaneTiltIcon,
    SunHorizonIcon,
    IdentificationBadgeIcon,
    ArrowsDownUpIcon,
    SignInIcon,
    SignOutIcon,
    MapPinIcon,
    MapPinLineIcon,
    ArchiveIcon,
    ArrowCounterClockwiseIcon,
    MegaphoneIcon,
    HandGrabbingIcon,
    HandIcon,
    SealCheckIcon,
    CalendarCheckIcon,
    SwapIcon,
    UserPlusIcon,
    UserMinusIcon,
    CoinsIcon,
    StackIcon,
    UsersThreeIcon,
    BuildingsIcon,
    ClockIcon,
} from '@phosphor-icons/react';

import { useAuthContext } from '@features/auth/AuthContext';
import { can } from '@shared/auth/permissions';
import { UserProfileModal } from '@features/profile/components/UserProfileModal';
import { type ShiftAuditLog, type ShiftSnapshot, type Profile } from '@shared/types';
import { formatClock, formatDateTime, monthShort } from '@shared/utils/date';
import { timesheetService, type AuditLogQuery } from './timesheetService';
import { AUDIT_GROUPS, AUDIT_GROUP_KEYS, dedupeFanout, groupLabel, type AuditGroup } from './auditCatalog';
import { useTimesheetRealtime } from './useTimesheetRealtime';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { Select } from '@shared/components/Select';
import { Skeleton } from '@shared/components/Skeleton';
import type { TranslationKey } from '@shared/i18n/translations';
import { PageHeader } from '@shared/components/PageHeader';

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
    schedule_created: { labelKey: 'audit.actionSchedCreated', Icon: PlusIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    schedule_updated: { labelKey: 'audit.actionSchedUpdated', Icon: PencilSimpleIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    schedule_removed: { labelKey: 'audit.actionSchedRemoved', Icon: TrashIcon, badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
    schedule_published: { labelKey: 'audit.actionSchedPublished', Icon: PaperPlaneTiltIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    timeoff_requested: { labelKey: 'audit.actionTimeoffRequested', Icon: SunHorizonIcon, badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    timeoff_approved: { labelKey: 'audit.actionTimeoffApproved', Icon: CheckCircleIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    timeoff_declined: { labelKey: 'audit.actionTimeoffDeclined', Icon: XCircleIcon, badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
    late_15: { labelKey: 'audit.actionLate', Icon: ClockCountdownIcon, badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    late_60: { labelKey: 'audit.actionLate', Icon: ClockCountdownIcon, badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    role_created: { labelKey: 'audit.roleCreated', Icon: IdentificationBadgeIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    role_updated: { labelKey: 'audit.roleUpdated', Icon: PencilSimpleIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    role_permissions: { labelKey: 'audit.rolePermissions', Icon: IdentificationBadgeIcon, badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' },
    role_moved: { labelKey: 'audit.roleMoved', Icon: ArrowsDownUpIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    role_deleted: { labelKey: 'audit.roleDeleted', Icon: TrashIcon, badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
    clock_in: { labelKey: 'audit.a.clock_in', Icon: SignInIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    clock_out: { labelKey: 'audit.a.clock_out', Icon: SignOutIcon, badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
    clock_switched: { labelKey: 'audit.a.clock_switched', Icon: MapPinIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    shift_confirmed: { labelKey: 'audit.a.shift_confirmed', Icon: SealCheckIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    open_shift_posted: { labelKey: 'audit.a.open_shift_posted', Icon: HandIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    open_shift_edited: { labelKey: 'audit.a.open_shift_edited', Icon: PencilSimpleIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    open_shift_claimed: { labelKey: 'audit.a.open_shift_claimed', Icon: HandGrabbingIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    open_shift_released: { labelKey: 'audit.a.open_shift_released', Icon: HandIcon, badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    open_shift_removed: { labelKey: 'audit.a.open_shift_removed', Icon: TrashIcon, badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
    template_created: { labelKey: 'audit.a.template_created', Icon: StackIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    template_updated: { labelKey: 'audit.a.template_updated', Icon: StackIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    template_deleted: { labelKey: 'audit.a.template_deleted', Icon: TrashIcon, badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
    coverage_updated: { labelKey: 'audit.a.coverage_updated', Icon: UsersThreeIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    availability_updated: { labelKey: 'audit.a.availability_updated', Icon: CalendarCheckIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    availability_removed: { labelKey: 'audit.a.availability_removed', Icon: CalendarCheckIcon, badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
    timeoff_cancelled: { labelKey: 'audit.a.timeoff_cancelled', Icon: XCircleIcon, badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
    swap_offered: { labelKey: 'audit.a.swap_offered', Icon: SwapIcon, badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    swap_taken: { labelKey: 'audit.a.swap_taken', Icon: SwapIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    swap_requested: { labelKey: 'audit.a.swap_requested', Icon: SwapIcon, badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    swap_approved: { labelKey: 'audit.a.swap_approved', Icon: CheckCircleIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    swap_declined: { labelKey: 'audit.a.swap_declined', Icon: XCircleIcon, badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
    swap_withdrawn: { labelKey: 'audit.a.swap_withdrawn', Icon: XCircleIcon, badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
    swap_released: { labelKey: 'audit.a.swap_released', Icon: SwapIcon, badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
    name_requested: { labelKey: 'audit.a.name_requested', Icon: UserGearIcon, badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    name_request_cancelled: { labelKey: 'audit.a.name_request_cancelled', Icon: XCircleIcon, badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
    member_invited: { labelKey: 'audit.a.member_invited', Icon: UserPlusIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    member_removed: { labelKey: 'audit.a.member_removed', Icon: UserMinusIcon, badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
    member_left: { labelKey: 'audit.a.member_left', Icon: UserMinusIcon, badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
    wage_changed: { labelKey: 'audit.a.wage_changed', Icon: CoinsIcon, badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' },
    wage_removed: { labelKey: 'audit.a.wage_removed', Icon: CoinsIcon, badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
    roster_added: { labelKey: 'audit.a.roster_added', Icon: MapPinLineIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    roster_removed: { labelKey: 'audit.a.roster_removed', Icon: MapPinLineIcon, badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
    announcement_posted: { labelKey: 'audit.a.announcement_posted', Icon: MegaphoneIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    announcement_edited: { labelKey: 'audit.a.announcement_edited', Icon: MegaphoneIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    announcement_deleted: { labelKey: 'audit.a.announcement_deleted', Icon: TrashIcon, badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
    location_created: { labelKey: 'audit.a.location_created', Icon: MapPinIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    location_updated: { labelKey: 'audit.a.location_updated', Icon: MapPinIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    location_archived: { labelKey: 'audit.a.location_archived', Icon: ArchiveIcon, badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
    location_restored: { labelKey: 'audit.a.location_restored', Icon: ArrowCounterClockwiseIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    location_hours: { labelKey: 'audit.a.location_hours', Icon: ClockIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    org_created: { labelKey: 'audit.a.org_created', Icon: BuildingsIcon, badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    org_updated: { labelKey: 'audit.a.org_updated', Icon: BuildingsIcon, badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
};

/** "rw" → "View · Change" for a permission cell. */
function fmtRights(flags: string | null | undefined, t: ReturnType<typeof useTranslation>): string {
    const f = flags ?? '';
    const parts = [f.includes('r') && t('roles.action.read'), f.includes('w') && t('roles.action.write'), f.includes('d') && t('roles.action.delete')].filter(Boolean);
    return parts.length ? parts.join(' · ') : t('audit.noRights');
}

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
    if (user && !can(user, 'activity.view')) return <Navigate to="/" replace />;
    return <AuditLogInner />;
}

function AuditLogInner() {
    const { user } = useAuthContext();
    const t = useTranslation();
    useTimesheetRealtime();

    const [targetUserId, setTargetUserId] = useState<string>('');
    const [group, setGroup] = useState<AuditGroup | ''>('');
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
        actions: group ? AUDIT_GROUPS[group] : null,
        sort,
    };

    const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['timesheets', 'audit', filters],
        queryFn: ({ pageParam }) => timesheetService.getAuditLog({ ...filters, limit: PAGE, offset: pageParam }),
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => (lastPage.length === PAGE ? allPages.length * PAGE : undefined),
        enabled: !!user,
    });

    const entries = dedupeFanout(data?.pages.flat() ?? []);

    return (
        <div className="space-y-4 px-1 pb-10">
            <PageHeader eyebrow={t('admin.administration')} title={t('nav.activity')} />

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
                <Select size="sm" fullWidth={false} value={group} onChange={(e) => setGroup(e.target.value as AuditGroup | '')}>
                    <option value="">{t('audit.allActions')}</option>
                    {AUDIT_GROUP_KEYS.map((g) => (
                        <option key={g} value={g}>
                            {t(groupLabel(g))}
                        </option>
                    ))}
                </Select>
                <Select size="sm" fullWidth={false} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                    <option value="desc">{t('audit.newest')}</option>
                    <option value="asc">{t('audit.oldest')}</option>
                </Select>
            </div>

            <section className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                    <ClockCounterClockwiseIcon weight="bold" className="w-4 h-4 text-emerald-500" />
                    <h2 className="text-label text-gray-400">{t(group ? groupLabel(group) : 'audit.everything')}</h2>
                </div>

                {error ? (
                    <div className="py-16 text-center space-y-1">
                        <p className="text-label text-red-500">{t('state.error')}</p>
                        <p className="text-small text-gray-400">
                            {error instanceof Error ? error.message : t('audit.loadError')}
                        </p>
                    </div>
                ) : isLoading ? (
                    <div className="space-y-2" aria-hidden>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="glass flex items-center gap-3 rounded-2xl p-4">
                                <Skeleton className="w-9 h-9 rounded-xl" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-3.5 w-2/5" />
                                    <Skeleton className="h-3 w-3/5" />
                                </div>
                                <Skeleton className="h-3 w-12" />
                            </div>
                        ))}
                    </div>
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
                                className="glass w-full py-2.5 rounded-xl text-label text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
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
        case 'schedule_created':
        case 'schedule_updated':
        case 'schedule_removed':
        case 'schedule_published':
        case 'late_15':
        case 'late_60': {
            const parts: string[] = [];
            if (d.count) parts.push(`${d.count} ${t('schedule.shiftsCount')}`);
            if (d.scheduled_start) {
                const dt = new Date(d.scheduled_start);
                parts.push(`${dt.getDate()} ${monthShort(dt)}${entry.action.startsWith('late') ? ` · ${fmtClock(d.scheduled_start)}` : ''}`);
            }
            if (d.location_name) parts.push(d.location_name);
            return parts.length > 0 ? (
                <p className="text-caption tabular-nums text-gray-700 dark:text-gray-200">{parts.join(' · ')}</p>
            ) : null;
        }
        case 'timeoff_requested':
        case 'timeoff_approved':
        case 'timeoff_declined': {
            const parts: string[] = [];
            if (d.kind) parts.push(t(`timeoff.${d.kind}` as TranslationKey));
            if (d.starts_on) {
                const from = new Date(`${d.starts_on}T00:00`);
                const range =
                    d.ends_on && d.ends_on !== d.starts_on
                        ? `${from.getDate()} ${monthShort(from)} – ${new Date(`${d.ends_on}T00:00`).getDate()} ${monthShort(new Date(`${d.ends_on}T00:00`))}`
                        : `${from.getDate()} ${monthShort(from)}`;
                parts.push(range);
            }
            return parts.length > 0 ? (
                <p className="text-caption tabular-nums text-gray-700 dark:text-gray-200">{parts.join(' · ')}</p>
            ) : null;
        }
        case 'profile_updated': {
            const rows = (d.changes ?? []).filter((c) => !!c.field);
            if (rows.length === 0) return null;
            return (
                <div className="space-y-0.5">
                    {rows.map((c, i) => (
                        <div key={i} className="flex flex-wrap items-baseline gap-x-1.5">
                            <span className="text-caption text-gray-400">{t(`notif.field.${c.field}` as TranslationKey)}:</span>
                            <DiffRow before={c.old || '—'} after={c.new || '—'} />
                        </div>
                    ))}
                </div>
            );
        }
        case 'role_created':
            return null;
        case 'role_updated':
            return d.old_name && d.old_name !== d.role_name ? <DiffRow before={d.old_name} after={d.role_name ?? '—'} /> : (
                <p className="flex items-center gap-1.5 text-caption text-gray-700 dark:text-gray-200">
                    {t('audit.roleColor')}
                    <span className="size-3 rounded-full" style={{ backgroundColor: d.old_color ?? undefined }} />
                    <ArrowRightIcon weight="bold" className="size-3 text-gray-300" />
                    <span className="size-3 rounded-full" style={{ backgroundColor: d.color ?? undefined }} />
                </p>
            );
        case 'role_moved':
            return (
                <p className="text-caption text-gray-700 dark:text-gray-200">
                    {t(d.direction === 'up' ? 'audit.roleMovedAbove' : 'audit.roleMovedBelow', { other: d.other_name ?? '—' })}
                </p>
            );
        case 'role_deleted':
            return d.moved ? (
                <p className="text-caption text-gray-700 dark:text-gray-200">{t('roles.deleteMoves', { n: d.moved, role: d.moved_to ?? '—' })}</p>
            ) : null;
        case 'role_permissions':
            return (
                <div className="space-y-0.5">
                    {(d.changes ?? []).filter((c) => !!c.area).map((c, i) => (
                        <div key={i} className="flex flex-wrap items-baseline gap-x-1.5">
                            <span className="text-caption text-gray-400">{t(`roles.area.${c.area}` as TranslationKey)}:</span>
                            <DiffRow before={fmtRights(c.old, t)} after={fmtRights(c.new, t)} />
                        </div>
                    ))}
                </div>
            );
        default:
            return <GenericBody entry={entry} />;
    }
}

/** "6 Nov · 09:00–17:00" (or just the date for all-day). */
function fmtRange(start?: string | null, end?: string | null, allDay?: boolean | null): string {
    if (!start) return '';
    const s = new Date(start);
    const day = `${s.getDate()} ${monthShort(s)}`;
    if (allDay) return day;
    return end ? `${day} · ${fmtClock(start)}–${fmtClock(end)}` : `${day} · ${fmtClock(start)}`;
}

function fmtDays(from?: string | null, to?: string | null): string {
    if (!from) return '';
    const a = new Date(`${from}T00:00`);
    const first = `${a.getDate()} ${monthShort(a)}`;
    if (!to || to === from) return first;
    const b = new Date(`${to}T00:00`);
    return `${first} – ${b.getDate()} ${monthShort(b)}`;
}

/** Shared layout for the newer events: one detail line + any field diffs. */
function GenericBody({ entry }: { entry: ShiftAuditLog }) {
    const t = useTranslation();
    const d = entry.details;
    const parts: string[] = [];
    if (d.kind) parts.push(t(`timeoff.${d.kind}` as TranslationKey));
    if (d.starts_at) parts.push(fmtRange(d.starts_at, d.ends_at, d.all_day));
    if (d.start_time) parts.push(`${d.start_time}–${d.end_time ?? ''}`);
    if (d.starts_on) parts.push(entry.action === 'wage_changed' ? t('audit.fromDate', { date: fmtDays(d.starts_on) }) : fmtDays(d.starts_on, d.ends_on));
    if (d.shift_role) parts.push(d.shift_role);
    if (d.location_name) parts.push(d.location_name);
    if (d.role_name && entry.action === 'member_invited') parts.push(d.role_name);
    if (d.email) parts.push(d.email);
    if (d.to_name) parts.push(t('audit.offeredTo', { name: d.to_name }));
    if (d.auto) parts.push(t('audit.autoClosed'));
    if (d.pinned) parts.push(t('audit.pinned'));
    const rows = (d.changes ?? []).filter((c) => !!c.field);
    const yesNo = (v?: string | null) => (v === 'true' ? t('audit.yes') : v === 'false' ? t('audit.no') : v || '—');

    if (parts.length === 0 && rows.length === 0 && !d.new_name && !d.note) return null;
    return (
        <div className="space-y-0.5">
            {parts.length > 0 && <p className="text-caption tabular-nums text-gray-700 dark:text-gray-200">{parts.join(' · ')}</p>}
            {d.new_name && (d.old_name ? <DiffRow before={d.old_name} after={d.new_name} /> : <p className="text-caption text-gray-700 dark:text-gray-200">{t('audit.requested', { name: d.new_name })}</p>)}
            {rows.map((c, i) => (
                <div key={i} className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-caption text-gray-400">{t(`audit.field.${c.field}` as TranslationKey)}{c.field === 'text' ? '' : ':'}</span>
                    {c.field !== 'text' && (
                        c.old == null && c.new != null ? (
                            <span className="text-caption tabular-nums text-gray-700 dark:text-gray-200">{c.field === 'pinned' ? yesNo(c.new) : c.new}</span>
                        ) : (
                            <DiffRow before={c.field === 'pinned' ? yesNo(c.old) : c.old || '—'} after={c.field === 'pinned' ? yesNo(c.new) : c.new || '—'} />
                        )
                    )}
                </div>
            ))}
            {d.note && <p className="text-caption text-gray-400">{d.note}</p>}
        </div>
    );
}

function AuditCard({ entry, onOpenUser }: { entry: ShiftAuditLog; onOpenUser: (userId: string) => void }) {
    const t = useTranslation();
    const meta = ACTION[entry.action] ?? FALLBACK_META;
    const actor = entry.details.actor_name ?? t('audit.someone');
    // Who/what the entry is about: a role, a place/announcement/template, or a person.
    const personId = entry.subject_id ?? entry.target_user_id;
    const target = entry.action.startsWith('role_')
        ? (entry.details.role_name ?? '—')
        : (entry.details.subject_name ?? entry.details.target_name ?? (personId ? t('audit.member') : null));
    const when = formatDateTime(entry.created_at);

    return (
        <div className="glass flex gap-3 p-3 rounded-2xl">
            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${meta.badge}`}>
                <meta.Icon weight="bold" className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
                {/* Action + who it was about (wraps instead of cramming on mobile). */}
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-body-strong text-gray-900 dark:text-white">
                        {t(meta.labelKey)}
                        {target ? ' ·' : ''}
                    </span>
                    {target && <PersonButton name={target} userId={entry.details.subject_name ? null : personId} onOpenUser={onOpenUser} strong />}
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
