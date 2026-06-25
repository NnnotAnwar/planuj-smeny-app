import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellIcon } from '@phosphor-icons/react';

/**
 * --- NOTIFICATIONS BELL ---
 * Header entry point for notifications. The notifications system isn't built
 * yet, so the panel shows an empty state for now — the button + dropdown are
 * ready to be wired to a real feed later.
 *
 * Closes on outside click (pointerdown anywhere outside the component) and on
 * Escape, which is more robust than a backdrop element across stacking contexts.
 */
export function NotificationsBell() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

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

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                aria-label="Notifications"
                aria-expanded={open}
                className="-mr-2 p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-emerald-500/5 dark:hover:bg-white/5 transition-all cursor-pointer active:scale-90"
            >
                <BellIcon weight="bold" className="w-7 h-7 md:w-5 md:h-5" />
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
                        className="absolute right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden"
                    >
                        <div className="px-4 py-3 border-b border-gray-50 dark:border-white/5">
                            <p className="text-body-strong text-gray-900 dark:text-white">Notifications</p>
                        </div>
                        <div className="p-6 flex flex-col items-center text-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-300 dark:text-gray-600">
                                <BellIcon weight="bold" className="w-6 h-6" />
                            </div>
                            <p className="text-small-strong text-gray-500 dark:text-gray-400">No notifications yet</p>
                            <p className="text-caption text-gray-400">You're all caught up.</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
