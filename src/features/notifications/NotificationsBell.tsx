import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
    BellIcon,
    PlusIcon,
    PencilSimpleIcon,
    TrashIcon,
    AtIcon,
    ClockCountdownIcon,
    PaperPlaneTiltIcon,
    SunHorizonIcon,
    CheckCircleIcon,
    XCircleIcon,
    UserGearIcon,
    XIcon,
    ArrowsLeftRightIcon,
    ChatTextIcon,
    type Icon,
} from '@phosphor-icons/react';
import type { ShiftAuditLog, ShiftSnapshot } from '@shared/types';
import { formatClock, formatDateTime, monthShort } from '@shared/utils/date';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import type { TranslationKey } from '@shared/i18n/translations';
import { useNotifications } from './useNotifications';
import { subscribeOpenNotifications } from './notificationsPanel';


function fmtClock(iso?: string | null): string {
    return formatClock(iso);
}
function fmtSnapshot(s?: ShiftSnapshot | null): string {
    if (!s || !s.started_at) return '';
    const d = new Date(s.started_at);
    return `${d.getDate()} ${monthShort(d)} · ${fmtClock(s.started_at)}–${fmtClock(s.ended_at)} · ${s.location_name ?? '—'}`;
}
function fmtWhen(iso: string): string {
    return formatDateTime(iso);
}

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/** "3 · 21 Jul · San Carlo" for grouped rota events. */
function fmtRota(d: { count?: number | null; scheduled_start?: string | null; location_name?: string | null }, t: Translate): string | undefined {
    const parts: string[] = [];
    if (d.count) parts.push(`${d.count} ${t('schedule.shiftsCount')}`);
    if (d.scheduled_start) {
        const dt = new Date(d.scheduled_start);
        parts.push(`${dt.getDate()} ${monthShort(dt)}`);
    }
    if (d.location_name) parts.push(d.location_name);
    return parts.join(' · ') || undefined;
}

/** "Vacation · 21 Jul – 25 Jul" for time-off events. */
function fmtLeave(d: { kind?: string | null; starts_on?: string | null; ends_on?: string | null }, t: Translate): string | undefined {
    const parts: string[] = [];
    if (d.kind) parts.push(t(`timeoff.${d.kind}` as TranslationKey));
    if (d.starts_on) {
        const from = new Date(`${d.starts_on}T00:00`);
        const fromTxt = `${from.getDate()} ${monthShort(from)}`;
        if (d.ends_on && d.ends_on !== d.starts_on) {
            const to = new Date(`${d.ends_on}T00:00`);
            parts.push(`${fromTxt} – ${to.getDate()} ${monthShort(to)}`);
        } else {
            parts.push(fromTxt);
        }
    }
    return parts.join(' · ') || undefined;
}

const FIELD_LABEL: Record<string, TranslationKey> = {
    manager: 'notif.field.manager',
    name: 'notif.field.name',
    role: 'notif.field.role',
    organization: 'notif.field.organization',
};

/** "Role: Manager · Organization: Acme" from a profile_updated audit entry. */
function fmtProfileChanges(changes: { field?: string; new?: string | null }[] | undefined, t: Translate): string | undefined {
    const rows = (changes ?? []).filter((c) => !!c.field);
    if (rows.length === 0) return undefined;
    return rows
        .map((c) => `${t(FIELD_LABEL[c.field!] ?? 'notif.field.name')}: ${c.new || '—'}`)
        .join(' · ');
}

/** Map an audit entry to an employee-facing notification (icon, title, detail). */
function describe(entry: ShiftAuditLog, t: Translate): { Icon: Icon; tint: string; title: string; detail?: string } {
    const d = entry.details;
    switch (entry.action) {
        case 'create':
            return { Icon: PlusIcon, tint: 'text-emerald-500', title: t('notif.shiftAdded'), detail: fmtSnapshot(d.new) };
        case 'update':
            return { Icon: PencilSimpleIcon, tint: 'text-blue-500', title: t('notif.shiftChanged'), detail: fmtSnapshot(d.new) };
        case 'delete':
            return { Icon: TrashIcon, tint: 'text-red-500', title: t('notif.shiftRemoved'), detail: fmtSnapshot(d.old) };
        case 'username_change':
            return { Icon: AtIcon, tint: 'text-violet-500', title: t('notif.usernameChanged'), detail: d.new_username ? `@${d.new_username}` : undefined };
        case 'name_request_approved':
            return { Icon: CheckCircleIcon, tint: 'text-emerald-500', title: t('notif.nameApproved'), detail: d.new_name || undefined };
        case 'name_request_rejected':
            return { Icon: XCircleIcon, tint: 'text-red-500', title: t('notif.nameDeclined'), detail: d.note || undefined };
        case 'profile_updated':
            return { Icon: UserGearIcon, tint: 'text-blue-500', title: t('notif.profileUpdated'), detail: fmtProfileChanges(d.changes, t) };
        case 'schedule_published':
            return { Icon: PaperPlaneTiltIcon, tint: 'text-emerald-500', title: t('notif.schedulePublished'), detail: fmtRota(d, t) };
        case 'schedule_updated':
            return { Icon: PencilSimpleIcon, tint: 'text-blue-500', title: t('notif.scheduleUpdated'), detail: fmtRota(d, t) };
        case 'schedule_removed':
            return { Icon: TrashIcon, tint: 'text-red-500', title: t('notif.scheduleRemoved'), detail: fmtRota(d, t) };
        case 'timeoff_requested':
            return { Icon: SunHorizonIcon, tint: 'text-amber-500', title: t('notif.timeoffRequested', { name: d.target_name || '—' }), detail: fmtLeave(d, t) };
        case 'timeoff_approved':
            return { Icon: CheckCircleIcon, tint: 'text-emerald-500', title: t('notif.timeoffApproved'), detail: fmtLeave(d, t) };
        case 'timeoff_declined':
            return { Icon: XCircleIcon, tint: 'text-red-500', title: t('notif.timeoffDeclined'), detail: fmtLeave(d, t) };
        case 'late_15':
        case 'late_60':
            // Same entry goes to the late member and their manager; the name in
            // the title reads fine for both.
            return {
                Icon: ClockCountdownIcon,
                tint: 'text-amber-500',
                title: t(entry.action === 'late_60' ? 'notif.late60' : 'notif.late15', { name: d.target_name || '—' }),
                detail: [d.location_name, d.scheduled_start ? fmtClock(d.scheduled_start) : null].filter(Boolean).join(' · ') || undefined,
            };
        case 'swap_taken':
        case 'swap_requested':
        case 'swap_approved':
        case 'swap_declined': {
            const when = d.scheduled_start
                ? `${formatDateTime(d.scheduled_start)}${d.location_name ? ` · ${d.location_name}` : ''}`
                : d.location_name || undefined;
            if (entry.action === 'swap_taken')
                return { Icon: ArrowsLeftRightIcon, tint: 'text-blue-500', title: t('notif.swapTaken', { name: d.taker_name || '—' }), detail: when };
            if (entry.action === 'swap_requested')
                return {
                    Icon: ArrowsLeftRightIcon,
                    tint: 'text-amber-500',
                    title: t('notif.swapRequested', { from: d.from_name || '—', taker: d.taker_name || '—' }),
                    detail: when,
                };
            return entry.action === 'swap_approved'
                ? { Icon: CheckCircleIcon, tint: 'text-emerald-500', title: t('notif.swapApproved'), detail: when }
                : { Icon: XCircleIcon, tint: 'text-red-500', title: t('notif.swapDeclined'), detail: [when, d.note].filter(Boolean).join(' · ') || undefined };
        }
        case 'request_submitted':
            return d.kind === 'complaint'
                ? { Icon: ChatTextIcon, tint: 'text-amber-500', title: t('notif.complaintSubmitted'), detail: d.target_name || t('audit.anonymous') }
                : {
                      Icon: ChatTextIcon,
                      tint: 'text-amber-500',
                      title: t('notif.requestSubmitted', { name: d.target_name || '—' }),
                      detail: [t(`mreq.kind.${d.kind ?? 'other'}` as TranslationKey), d.role_name, d.subject_name].filter(Boolean).join(' · '),
                  };
        case 'request_approved':
        case 'request_declined':
            return {
                Icon: entry.action === 'request_approved' ? CheckCircleIcon : XCircleIcon,
                tint: entry.action === 'request_approved' ? 'text-emerald-500' : 'text-red-500',
                title: t(entry.action === 'request_approved' ? 'notif.requestApproved' : 'notif.requestDeclined'),
                detail: [d.role_name ?? d.subject_name, d.note].filter(Boolean).join(' · ') || undefined,
            };
        default:
            return { Icon: BellIcon, tint: 'text-gray-400', title: t('notif.account') };
    }
}

/**
 * --- NOTIFICATIONS BELL ---
 * The current user's notifications (their own audit-log entries): shift changes
 * to their schedule, username changes, and name-change request decisions.
 *
 * - Unread (arrived since the panel was last closed) are highlighted; read ones
 *   are muted.
 * - The badge counts unread and is hidden while the panel is open; closing the
 *   panel commits the "seen" watermark so the badge clears.
 * - Notifications can be dismissed individually or all at once (per device).
 */
export function NotificationsBell({ variant = 'header' }: { variant?: 'header' | 'rail' } = {}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    // Fixed-position coords for the portal panel. The bell can sit anywhere
    // (header, or the BOTTOM of the collapsed rail), so anchor the panel edge
    // nearest the trigger: top-aligned for a trigger in the upper half of the
    // screen, bottom-aligned for the lower half — the panel then grows toward
    // the free space whatever its real height, never drifting away.
    const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(null);
    const { notifications, unread, isUnread, markSeen, dismiss, clearAll, isLoading } = useNotifications();
    const t = useTranslation();

    const place = useCallback(() => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const isDesktop = window.matchMedia('(min-width: 768px)').matches;
        const lowerHalf = r.top > window.innerHeight / 2;
        const vertical = lowerHalf
            ? { bottom: Math.max(8, window.innerHeight - r.bottom) }
            : { top: Math.max(8, r.top) };
        if (isDesktop) {
            // Flyout to the right of the trigger (sidebar/rail).
            setPos({ left: r.right + 8, ...vertical });
        } else {
            // Mobile: right-aligned under (or above) the trigger.
            setPos({ right: Math.max(8, window.innerWidth - r.right), ...(lowerHalf ? vertical : { top: r.bottom + 8 }) });
        }
    }, []);

    useLayoutEffect(() => {
        if (!open) return;
        place();
        const onMove = () => place();
        window.addEventListener('resize', onMove);
        window.addEventListener('scroll', onMove, true);
        return () => {
            window.removeEventListener('resize', onMove);
            window.removeEventListener('scroll', onMove, true);
        };
    }, [open, place]);

    // Open when a deep-linked push asks for the notifications panel.
    useEffect(() => subscribeOpenNotifications(() => setOpen(true)), []);

    // Closing commits "seen" (so unread highlight persists while open).
    const close = () => {
        setOpen(false);
        markSeen();
    };

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Node;
            if (ref.current?.contains(target) || panelRef.current?.contains(target)) return;
            close();
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => (open ? close() : setOpen(true))}
                aria-label={t('notif.title')}
                aria-expanded={open}
                className={
                    variant === 'rail'
                        ? // Collapsed sidebar: same 36px square and idle colours as the other rail icons.
                          'relative flex size-9 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-white/60 active:scale-90 dark:text-slate-400 dark:hover:bg-white/5'
                        : 'relative -mr-2 p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-emerald-500/5 dark:hover:bg-white/5 transition-all cursor-pointer active:scale-90'
                }
            >
                <BellIcon weight="bold" className={variant === 'rail' ? 'size-4.5' : 'w-7 h-7 md:w-5 md:h-5'} />
                {!open && unread > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-micro font-bold flex items-center justify-center leading-none">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {/* Portal panel (no AnimatePresence — it drops portal children). */}
            {open && pos && createPortal(
                    <motion.div
                        ref={panelRef}
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.15 }}
                        role="dialog"
                        aria-label={t('notif.title')}
                        style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right }}
                        className="glass glass-menu z-100 w-80 max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden"
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-white/5">
                            <p className="text-body-strong text-gray-900 dark:text-white">{t('notif.title')}</p>
                            {notifications.length > 0 && (
                                <button
                                    onClick={clearAll}
                                    className="text-caption font-semibold text-emerald-600 dark:text-emerald-400 hover:underline underline-offset-2"
                                >
                                    {t('notif.clearAll')}
                                </button>
                            )}
                        </div>

                        <div className="max-h-96 overflow-y-auto">
                            {isLoading ? (
                                <p className="p-6 text-center text-caption text-gray-400">{t('common.loading')}</p>
                            ) : notifications.length === 0 ? (
                                <div className="p-6 flex flex-col items-center text-center gap-2">
                                    <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-300 dark:text-gray-600">
                                        <BellIcon weight="bold" className="w-6 h-6" />
                                    </div>
                                    <p className="text-small-strong text-gray-500 dark:text-gray-400">{t('notif.empty')}</p>
                                    <p className="text-caption text-gray-400">{t('notif.emptyHint')}</p>
                                </div>
                            ) : (
                                notifications.map((n) => {
                                    const { Icon, tint, title, detail } = describe(n, t);
                                    const fresh = isUnread(n);
                                    return (
                                        <div
                                            key={n.id}
                                            className={`group flex gap-3 px-4 py-3 border-b border-gray-50 dark:border-white/5 last:border-b-0 transition-colors ${
                                                fresh ? 'bg-emerald-50/60 dark:bg-emerald-900/10' : ''
                                            }`}
                                        >
                                            <div className={`shrink-0 mt-0.5 ${tint}`}>
                                                <Icon weight="bold" className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    {fresh && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-label="Unread" />}
                                                    <p className={`text-small-strong ${fresh ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                                                        {title}
                                                    </p>
                                                </div>
                                                {detail && <p className="text-caption text-gray-500 dark:text-gray-400 truncate">{detail}</p>}
                                                <p className="text-micro text-gray-400 mt-0.5">{fmtWhen(n.created_at)}</p>
                                            </div>
                                            <button
                                                onClick={() => dismiss(n.id)}
                                                aria-label={t('notif.dismiss')}
                                                className="shrink-0 self-start -mr-1 -mt-0.5 p-1 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 dark:text-gray-600 dark:hover:text-gray-300 dark:hover:bg-white/5 transition-colors"
                                            >
                                                <XIcon weight="bold" className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>,
                    document.body,
                )}
        </div>
    );
}
