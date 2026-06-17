import { motion } from 'framer-motion';
import { XIcon, WarningIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';

/**
 * --- MODAL ---
 * Reusable centered, animated modal shell used by every admin form.
 * Closes on backdrop click or the corner X.
 */
export function Modal({
    title,
    subtitle,
    onClose,
    children,
}: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: ReactNode;
}) {
    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden"
            >
                <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-50 dark:border-white/5">
                    <div className="min-w-0">
                        <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight truncate">{title}</h2>
                        {subtitle && (
                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-0.5">{subtitle}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="shrink-0 p-2 -m-1 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                        aria-label="Close"
                    >
                        <XIcon weight="bold" className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5">{children}</div>
            </motion.div>
        </motion.div>
    );
}

/**
 * --- CONFIRM DIALOG ---
 * Destructive-action confirmation. Runs the async `onConfirm`, surfaces any
 * error inline, and keeps itself open until the action resolves.
 */
export function ConfirmDialog({
    title,
    message,
    confirmLabel = 'Delete',
    onConfirm,
    onClose,
}: {
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => Promise<void>;
    onClose: () => void;
}) {
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirm = async () => {
        setIsBusy(true);
        setError(null);
        try {
            await onConfirm();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Action failed. Please try again.');
            setIsBusy(false);
        }
    };

    return (
        <Modal title={title} onClose={onClose}>
            <div className="space-y-5">
                <div className="flex gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center">
                        <WarningIcon weight="fill" className="w-5 h-5" />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{message}</p>
                </div>

                {error && (
                    <p className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</p>
                )}

                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        disabled={isBusy}
                        className="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isBusy}
                        className="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-60 shadow-lg shadow-red-500/20"
                    >
                        {isBusy ? 'Working…' : confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
