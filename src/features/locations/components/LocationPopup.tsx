import { motion } from 'framer-motion';
import { MapPinIcon, ArrowsLeftRightIcon, InfoIcon, type Icon } from '@phosphor-icons/react';

/**
 * --- LOCATION POPUP ---
 * Confirms picking / switching a work location. Purely presentational — the
 * parent (AppShell) owns the state and the confirm action. Big, well-separated
 * buttons so OK / Cancel are hard to mis-tap on a phone, styled like the rest
 * of the app (bottom sheet on mobile, centered card on desktop).
 */

export type LocationPopupVariant = 'confirm' | 'switch' | 'same';

export interface LocationPopupProps {
    locationName: string;
    variant: LocationPopupVariant;
    isBusy: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const COPY: Record<LocationPopupVariant, { title: string; sub: string; icon: Icon; tint: string }> = {
    confirm: {
        title: 'Start here?',
        sub: 'Set your location to',
        icon: MapPinIcon,
        tint: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    },
    switch: {
        title: 'Move your shift?',
        sub: 'Change your location to',
        icon: ArrowsLeftRightIcon,
        tint: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    },
    same: {
        title: "You're already here",
        sub: 'Your current location',
        icon: InfoIcon,
        tint: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
    },
};

export function LocationPopup({ locationName, variant, isBusy, onConfirm, onCancel }: LocationPopupProps) {
    const { title, sub, icon: VariantIcon, tint } = COPY[variant];
    const isSame = variant === 'same';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
            onClick={onCancel}
        >
            <motion.div
                initial={{ y: '100%', opacity: 0.6, scale: 1 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl border border-gray-100 dark:border-gray-800 shadow-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6"
            >
                {/* Grab handle (mobile bottom-sheet affordance) */}
                <div className="sm:hidden mx-auto mb-5 h-1.5 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />

                <div className="flex flex-col items-center text-center">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${tint}`}>
                        <VariantIcon weight="bold" className="w-7 h-7" />
                    </div>
                    <h2 className="text-title text-gray-900 dark:text-white mt-4">{title}</h2>
                    <p className="text-micro text-gray-400 mt-3">{sub}</p>
                    <p className="text-heading text-gray-900 dark:text-white mt-1">{locationName}</p>
                </div>

                <div className={`mt-7 ${isSame ? '' : 'flex gap-3'}`}>
                    {isSame ? (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="w-full py-4 rounded-2xl text-body-strong text-white bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all"
                        >
                            Got it
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={onCancel}
                                disabled={isBusy}
                                className="flex-1 py-4 rounded-2xl text-body-strong text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-[0.98] disabled:opacity-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onConfirm}
                                disabled={isBusy}
                                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-body-strong text-white bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 transition-all"
                            >
                                {isBusy && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                                {isBusy ? 'Saving…' : 'Confirm'}
                            </button>
                        </>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
