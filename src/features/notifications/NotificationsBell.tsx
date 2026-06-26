import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    BellIcon,
    PlusIcon,
    PencilSimpleIcon,
    TrashIcon,
    AtIcon,
    CheckCircleIcon,
    XCircleIcon,
    XIcon,
    type Icon,
} from '@phosphor-icons/react';
import type { ShiftAuditLog, ShiftSnapshot } from '@shared/types';
import { formatClock, formatDateTime, monthShort } from '@shared/utils/date';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import type { TranslationKey } from '@shared/i18n/translations';
import { useNotifications } from './useNotifications';


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
export function NotificationsBell() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const { notifications, unread, isUnread, markSeen, dismiss, clearAll, isLoading } = useNotifications();
    const t = useTranslation();

    // Closing commits "seen" (so unread highlight persists while open).
    const close = () => {
        setOpen(false);
        markSeen();
    };

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: PointerEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) close();
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
                className="relative -mr-2 p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-emerald-500/5 dark:hover:bg-white/5 transition-all cursor-pointer active:scale-90"
            >
                <BellIcon weight="bold" className="w-7 h-7 md:w-5 md:h-5" />
                {!open && unread > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-micro font-bold flex items-center justify-center leading-none">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        role="dialog"
                        aria-label={t('notif.title')}
                        className="absolute right-0 md:left-full md:right-auto top-full mt-2 z-50 w-80 max-w-[calc(100vw-2rem)] origin-top-right rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden"
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
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
