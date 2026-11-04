import { motion } from 'framer-motion';
import { XIcon, WarningIcon } from '@phosphor-icons/react';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { Button } from '@shared/components/Button';
import { FormError } from '@shared/components/FormError';
import { useBackHandler } from '@shared/hooks/useBackHandler';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

/**
 * --- MODAL ---
 * Reusable centered, animated modal shell used by every admin form.
 *
 * Mobile-hardened: the panel is capped at 90dvh with its body scrolling
 * independently (so a tall form + the on-screen keyboard can't push the action
 * buttons off-screen), the background scroll is locked while open, Escape and
 * backdrop close it, focus is trapped inside, and it's announced as a dialog.
 *
 * Rendered into <body> through a portal: a frosted (`glass`) ancestor has a
 * backdrop-filter, which makes it the containing block for `position: fixed`
 * — without the portal a modal opened from inside a card would be trapped in
 * that card instead of covering the screen.
 */
export function Modal({
    title,
    subtitle,
    onClose,
    children,
    wide = false,
}: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: ReactNode;
    /** Wider panel on sm+ for content-heavy dialogs (e.g. the rota day editor). */
    wide?: boolean;
}) {
    const t = useTranslation();
    const panelRef = useRef<HTMLDivElement>(null);

    // Android hardware back closes the modal before navigating.
    useBackHandler(true, onClose);

    useEffect(() => {
        // Lock background scroll while the modal is open.
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // Move focus into the dialog.
        panelRef.current?.focus();

        // On native, hide the on-screen keyboard when user taps the backdrop or closes.
        const hideNativeKeyboard = async () => {
            if (Capacitor.isNativePlatform()) {
                try {
                    await Keyboard.hide();
                } catch { /* keyboard already hidden */ }
            }
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                hideNativeKeyboard();
                return;
            }
            if (e.key !== 'Tab') return;
            // Trap Tab focus within the panel.
            const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
            );
            if (!focusables || focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown);

        // Tap on backdrop also hides native keyboard
        const handleBackdrop = (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest('.backdrop')) {
                hideNativeKeyboard();
            }
        };
        document.addEventListener('mousedown', handleBackdrop as EventListener, true);

        return () => {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('mousedown', handleBackdrop as EventListener, true);
        };
    }, [onClose]);

    return createPortal(
        <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="absolute inset-0 bg-slate-ink/35 backdrop-blur-sm" onClick={onClose} />

            <motion.div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                initial={{ opacity: 0, scale: 0.97, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 16 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`glass glass-menu relative w-full ${wide ? 'sm:max-w-2xl' : 'max-w-md'} max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden outline-none`}
            >
                <div className="flex items-start justify-between gap-4 px-4 py-3.5 border-b border-ink/5 dark:border-white/6 shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-card-title text-ink dark:text-white truncate">{title}</h2>
                        {subtitle && (
                            <p className="text-eyebrow text-emerald-600 dark:text-emerald-300 mt-1">{subtitle}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="shrink-0 flex size-8 -my-1 -mr-1.5 items-center justify-center rounded-lg text-ink-soft hover:text-ink hover:bg-ink/5 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5 transition-colors"
                        aria-label={t('common.close')}
                    >
                        <XIcon weight="bold" className="size-4" />
                    </button>
                </div>

                {/* Scrollable body; safe-area padding so the last field clears the home indicator. */}
                <div className="p-4 overflow-y-auto overscroll-contain pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
                    {children}
                </div>
            </motion.div>
        </motion.div>,
        document.body,
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
    confirmLabel,
    onConfirm,
    onClose,
}: {
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => Promise<void>;
    onClose: () => void;
}) {
    const t = useTranslation();
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirm = async () => {
        setIsBusy(true);
        setError(null);
        try {
            await onConfirm();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('common.actionFailedRetry'));
            setIsBusy(false);
        }
    };

    return (
        <Modal title={title} onClose={onClose}>
            <div className="space-y-4">
                <div className="flex gap-3">
                    <div className="shrink-0 size-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                        <WarningIcon weight="fill" className="size-4.5" />
                    </div>
                    <p className="text-body text-ink-soft dark:text-slate-300 leading-relaxed">{message}</p>
                </div>

                <FormError message={error} />

                <div className="flex gap-2">
                    <Button variant="secondary" fullWidth onClick={onClose} disabled={isBusy}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="danger" fullWidth loading={isBusy} onClick={handleConfirm}>
                        {isBusy ? t('common.working') : (confirmLabel ?? t('common.delete'))}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
