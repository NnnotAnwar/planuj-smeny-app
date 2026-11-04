import { useState } from 'react';
import { CheckCircleIcon, CheckIcon } from '@phosphor-icons/react';
import type { ScheduledShift, User } from '@shared/types';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { formatTime, weekdayShort } from '@shared/utils/date';
import { useShiftConfirmations } from './useShiftConfirmations';

/**
 * --- UPCOMING SHIFTS (member) ---
 * The member's next published shifts as a compact list, each with a one-tap
 * "Confirm" so the manager knows the rota was seen. Tapping a confirmed row's
 * badge withdraws it (mis-taps happen).
 */
export function UpcomingShifts({
    user,
    shifts,
    locationName,
}: {
    user: User;
    /** The member's own shifts (any month window). */
    shifts: ScheduledShift[];
    locationName: (id: string | null) => string;
}) {
    const t = useTranslation();
    const { confirmedIds, confirm, unconfirm } = useShiftConfirmations(user);

    // Snapshot of "now" for this mount — the list doesn't need to tick live.
    const [now] = useState(() => Date.now());
    const upcoming = shifts
        .filter((s) => s.published && new Date(s.ends_at).getTime() > now)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        .slice(0, 8);
    const pending = upcoming.filter((s) => !confirmedIds.has(s.id)).length;

    return (
        <section className="glass rounded-2xl p-3">
            <header className="mb-2 flex items-center justify-between gap-2 px-1">
                <h2 className="text-card-title text-ink dark:text-white">{t('confirm.upcoming')}</h2>
                {pending > 0 && (
                    <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        {t('confirm.toConfirm', { n: pending })}
                    </span>
                )}
            </header>

            {upcoming.length === 0 ? (
                <p className="px-1 py-2 text-meta text-ink-soft dark:text-slate-400">{t('confirm.none')}</p>
            ) : (
                <ul className="space-y-1">
                    {upcoming.map((s) => {
                        const d = new Date(s.starts_at);
                        const done = confirmedIds.has(s.id);
                        const busy = (confirm.isPending && confirm.variables === s.id) || (unconfirm.isPending && unconfirm.variables === s.id);
                        return (
                            <li key={s.id} className="flex items-center gap-2.5 rounded-xl bg-white/55 p-1.5 ring-1 ring-ink/5 dark:bg-white/4 dark:ring-white/6">
                                <span className="flex h-9 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-ink/5 dark:bg-white/6">
                                    <span className="text-[13px] font-bold leading-none tabular-nums text-ink dark:text-white">{d.getDate()}</span>
                                    <span className="mt-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-ink-soft dark:text-slate-400">{weekdayShort(d)}</span>
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-meta font-semibold text-ink dark:text-white">{locationName(s.location_id)}</span>
                                    <span className="block text-caption tabular-nums text-ink-soft dark:text-slate-400">
                                        {s.all_day ? t('schedule.allDay') : `${formatTime(s.starts_at)}–${formatTime(s.ends_at)}`}
                                    </span>
                                </span>
                                {done ? (
                                    <button
                                        type="button"
                                        onClick={() => unconfirm.mutate(s.id)}
                                        disabled={busy}
                                        title={t('confirm.undo')}
                                        className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-meta font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10 disabled:opacity-60 dark:text-emerald-300"
                                    >
                                        <CheckCircleIcon weight="fill" className="size-4" />
                                        {t('confirm.done')}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => confirm.mutate(s.id)}
                                        disabled={busy}
                                        className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500/12 px-2.5 py-1 text-meta font-semibold text-emerald-700 ring-1 ring-emerald-500/20 transition-colors hover:bg-emerald-500/20 disabled:opacity-60 dark:text-emerald-300"
                                    >
                                        <CheckIcon weight="bold" className="size-3.5" />
                                        {t('confirm.action')}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
