import { motion } from 'framer-motion';
import { MapPinIcon, ArrowsLeftRightIcon, type Icon } from '@phosphor-icons/react';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import type { TranslationKey } from '@shared/i18n/translations';

/**
 * --- LOCATION POPUP ---
 * Confirms picking / switching a work location. Purely presentational — the
 * parent (AppShell) owns the state and the confirm action. Compact, left-aligned
 * (the location name is the hero and fills the width), with full-width Cancel /
 * Confirm buttons that are hard to mis-tap. Bottom sheet on mobile, centered card
 * on desktop. (The "already here" case is a top toast, not this popup.)
 */

export type LocationPopupVariant = 'confirm' | 'switch';

export interface LocationPopupProps {
    locationName: string;
    variant: LocationPopupVariant;
    isBusy: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const COPY: Record<LocationPopupVariant, { subKey: TranslationKey; icon: Icon; tint: string }> = {
    confirm: {
        subKey: 'location.startAt',
        icon: MapPinIcon,
        tint: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    },
    switch: {
        subKey: 'location.moveTo',
        icon: ArrowsLeftRightIcon,
        tint: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    },
};

export function LocationPopup({ locationName, variant, isBusy, onConfirm, onCancel }: LocationPopupProps) {
    const t = useTranslation();
    const { subKey, icon: VariantIcon, tint } = COPY[variant];

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
                initial={{ y: '100%', opacity: 0.6 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl border border-gray-100 dark:border-gray-800 shadow-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5"
            >
                {/* Grab handle (mobile bottom-sheet affordance) */}
                <div className="sm:hidden mx-auto mb-4 h-1.5 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />

                <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${tint}`}>
                        <VariantIcon weight="bold" className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-micro text-gray-400">{t(subKey)}</p>
                        <p className="text-title text-gray-900 dark:text-white leading-snug truncate">{locationName}</p>
                    </div>
                </div>

                <div className="mt-5 flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isBusy}
                        className="flex-1 py-3.5 rounded-2xl text-body-strong text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-[0.98] disabled:opacity-50 transition-all"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isBusy}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-body-strong text-white bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 transition-all"
                    >
                        {isBusy && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                        {isBusy ? t('common.saving') : t('location.confirm')}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
