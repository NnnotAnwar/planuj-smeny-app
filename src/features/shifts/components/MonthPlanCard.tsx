import { ListChecksIcon } from '@phosphor-icons/react';
import type { ScheduledShift } from '@shared/types';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { formatDateLong } from '@shared/utils/date';

/**
 * --- THIS MONTH'S PLAN (Overview) ---
 * Shifts worked vs. shifts on the published rota for the month, with what's
 * still ahead ("3 left · next Fri 20 Nov"). Counted in shifts, not hours: many
 * rota entries are all-day, which carry no planned duration.
 */
export function MonthPlanCard({ planned, worked, now }: { planned: ScheduledShift[]; worked: number; now: number }) {
    const t = useTranslation();
    const upcoming = planned.filter((s) => new Date(s.ends_at).getTime() > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const pct = planned.length > 0 ? Math.min(100, (worked / planned.length) * 100) : 0;

    return (
        <div className="glass rounded-2xl p-4">
            <h2 className="flex items-center gap-1.5 text-label text-ink-soft dark:text-slate-400">
                <ListChecksIcon weight="bold" className="size-3.5 text-emerald-600 dark:text-emerald-300" /> {t('overview.plan')}
            </h2>
            {planned.length === 0 ? (
                <p className="mt-3 text-meta text-ink-soft dark:text-slate-400">{t('overview.planNone')}</p>
            ) : (
                <>
                    <p className="mt-2.5 text-metric text-ink dark:text-white">
                        {t('overview.planWorked', { worked, planned: planned.length })}
                    </p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/6 dark:bg-white/8">
                        <div className="h-full rounded-full bg-linear-to-r from-emerald-500 to-emerald-400 transition-[width] duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-2 text-caption text-ink-soft dark:text-slate-400">
                        {upcoming.length > 0
                            ? `${t('overview.planLeft', { n: upcoming.length })} · ${t('overview.planNext', { date: formatDateLong(upcoming[0].starts_at) })}`
                            : t('overview.planDone')}
                    </p>
                </>
            )}
        </div>
    );
}
