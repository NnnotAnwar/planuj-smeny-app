import type { Icon } from '@phosphor-icons/react';
import { useTranslation } from '@shared/preferences/PreferencesContext';

/** Small presentational helpers shared across the admin panel. */

const STAT_ACCENTS: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
};

export function StatCard({
    icon: StatIcon,
    label,
    value,
    accent,
}: {
    icon: Icon;
    label: string;
    value: number;
    accent: string;
}) {
    return (
        <div className="p-2.5 sm:p-4 bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${STAT_ACCENTS[accent]}`}>
                    <StatIcon className="w-4 h-4 sm:w-5 sm:h-5" weight="bold" />
                </div>
                <p className="text-xl sm:text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">{value}</p>
            </div>
            <p className="text-micro tracking-tight text-gray-400 mt-2 truncate">{label}</p>
        </div>
    );
}

export function EmptyState({ label }: { label: string }) {
    const t = useTranslation();
    return (
        <div className="py-20 text-center text-label text-gray-400">{t('state.empty', { label })}</div>
    );
}

export function ErrorState({ message }: { message: string }) {
    const t = useTranslation();
    return (
        <div className="py-16 text-center space-y-1">
            <p className="text-label text-red-500">{t('state.error')}</p>
            <p className="text-small text-gray-400">{message}</p>
        </div>
    );
}
