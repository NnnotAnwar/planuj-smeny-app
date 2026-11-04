import type { Icon } from '@phosphor-icons/react';
import { useTranslation } from '@shared/preferences/PreferencesContext';

/** Small presentational helpers shared across the admin panel. */

const STAT_ACCENTS: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    blue: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
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
        <div className="glass p-3 rounded-2xl min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${STAT_ACCENTS[accent]}`}>
                    <StatIcon className="size-4" weight="bold" />
                </div>
                <div className="min-w-0">
                    <p className="text-metric leading-none text-ink dark:text-white">{value}</p>
                    <p className="text-eyebrow text-ink-soft dark:text-slate-400 mt-1 truncate">{label}</p>
                </div>
            </div>
        </div>
    );
}

export function EmptyState({ label }: { label: string }) {
    const t = useTranslation();
    return (
        <div className="py-12 text-center text-meta text-ink-soft dark:text-slate-400">{t('state.empty', { label })}</div>
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
