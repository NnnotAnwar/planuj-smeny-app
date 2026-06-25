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
    type Icon,
} from '@phosphor-icons/react';
import type { ShiftAuditLog, ShiftSnapshot } from '@shared/types';
import { useNotifications } from './useNotifications';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtClock(iso?: string | null): string {
    return iso ? new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '…';
}
function fmtSnapshot(s?: ShiftSnapshot | null): string {
    if (!s || !s.started_at) return '';
    const d = new Date(s.started_at);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${fmtClock(s.started_at)}–${fmtClock(s.ended_at)} · ${s.location_name ?? 'Unknown'}`;
}
function fmtWhen(iso: string): string {
    return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Map an audit entry to an employee-facing notification (icon, title, detail). */
function describe(entry: ShiftAuditLog): { Icon: Icon; tint: string; title: string; detail?: string } {
    const d = entry.details;
    switch (entry.action) {
        case 'create':
            return { Icon: PlusIcon, tint: 'text-emerald-500', title: 'A shift was added to your schedule', detail: fmtSnapshot(d.new) };
        case 'update':
            return { Icon: PencilSimpleIcon, tint: 'text-blue-500', title: 'One of your shifts was changed', detail: fmtSnapshot(d.new) };
        case 'delete':
            return { Icon: TrashIcon, tint: 'text-red-500', title: 'A shift was removed from your schedule', detail: fmtSnapshot(d.old) };
        case 'username_change':
            return { Icon: AtIcon, tint: 'text-violet-500', title: 'Your username was changed', detail: d.new_username ? `@${d.new_username}` : undefined };
        case 'name_request_approved':
            return { Icon: CheckCircleIcon, tint: 'text-emerald-500', title: 'Your name change was approved', detail: d.new_name || undefined };
        case 'name_request_rejected':
            return { Icon: XCircleIcon, tint: 'text-red-500', title: 'Your name change was declined', detail: d.note || undefined };
        default:
            return { Icon: BellIcon, tint: 'text-gray-400', title: 'Account activity' };
    }
}

/**
 * --- NOTIFICATIONS BELL ---
 * Shows the current user's notifications (their own audit-log entries): shift
 * changes to their schedule, username changes, and name-change request
 * decisions. An unread badge tracks entries newer than the last time the panel
 * was opened. Closes on outside click / Escape.
 */
export function NotificationsBell() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const { notifications, unread, markSeen, isLoading } = useNotifications();

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: PointerEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    const toggle = () => {
        setOpen((v) => {
            if (!v) markSeen(); // opening clears the unread badge
            return !v;
        });
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={toggle}
                aria-label="Notifications"
                aria-expanded={open}
                className="relative -mr-2 p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-emerald-500/5 dark:hover:bg-white/5 transition-all cursor-pointer active:scale-90"
            >
                <BellIcon weight="bold" className="w-7 h-7 md:w-5 md:h-5" />
                {unread > 0 && (
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
                        aria-label="Notifications"
                        className="absolute right-0 top-full mt-2 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden"
                    >
                        <div className="px-4 py-3 border-b border-gray-50 dark:border-white/5">
                            <p className="text-body-strong text-gray-900 dark:text-white">Notifications</p>
                        </div>

                        <div className="max-h-96 overflow-y-auto">
                            {isLoading ? (
                                <p className="p-6 text-center text-caption text-gray-400">Loading…</p>
                            ) : notifications.length === 0 ? (
                                <div className="p-6 flex flex-col items-center text-center gap-2">
                                    <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-300 dark:text-gray-600">
                                        <BellIcon weight="bold" className="w-6 h-6" />
                                    </div>
                                    <p className="text-small-strong text-gray-500 dark:text-gray-400">No notifications yet</p>
                                    <p className="text-caption text-gray-400">You're all caught up.</p>
                                </div>
                            ) : (
                                notifications.map((n) => {
                                    const { Icon, tint, title, detail } = describe(n);
                                    return (
                                        <div
                                            key={n.id}
                                            className="flex gap-3 px-4 py-3 border-b border-gray-50 dark:border-white/5 last:border-b-0"
                                        >
                                            <div className={`shrink-0 mt-0.5 ${tint}`}>
                                                <Icon weight="bold" className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-small-strong text-gray-900 dark:text-white">{title}</p>
                                                {detail && <p className="text-caption text-gray-500 dark:text-gray-400 truncate">{detail}</p>}
                                                <p className="text-micro text-gray-400 mt-0.5">{fmtWhen(n.created_at)}</p>
                                            </div>
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
