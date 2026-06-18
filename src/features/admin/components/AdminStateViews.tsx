import type { Icon } from '@phosphor-icons/react';

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
        <div className="flex items-center gap-3 p-3 sm:p-4 bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${STAT_ACCENTS[accent]}`}>
                <StatIcon className="w-5 h-5" weight="bold" />
            </div>
            <div className="min-w-0">
                <p className="text-display text-gray-900 dark:text-white leading-none">{value}</p>
                <p className="text-micro text-gray-400 mt-1">{label}</p>
            </div>
        </div>
    );
}

export function LoadingState({ label }: { label: string }) {
    return (
        <div className="py-20 text-center text-label text-gray-400 animate-pulse">
            Loading {label}…
        </div>
    );
}

export function EmptyState({ label }: { label: string }) {
    return (
        <div className="py-20 text-center text-label text-gray-400">No {label} found</div>
    );
}

export function ErrorState({ message }: { message: string }) {
    return (
        <div className="py-16 text-center space-y-1">
            <p className="text-label text-red-500">Something went wrong</p>
            <p className="text-small text-gray-400">{message}</p>
        </div>
    );
}
