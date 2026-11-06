import { useState } from 'react';
import { CheckIcon, LockSimpleIcon } from '@phosphor-icons/react';
import type { ScheduledShift, User } from '@shared/types';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { formatTime, weekdayShort } from '@shared/utils/date';
import { Button } from '@shared/components/Button';
import { useShiftConfirmations } from './useShiftConfirmations';

/**
 * --- UPCOMING SHIFTS (member) ---
 * The member's upcoming published shifts with a checkbox each: tick the ones
 * you've seen (or "Select all"), then "Confirm" sends them in one go so the
 * manager knows the rota landed. A confirmation is final — confirmed rows
 * are locked (only a manager can reset one), so the member commits once.
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
    const { confirmedIds, confirm } = useShiftConfirmations(user);
    const [selected, setSelected] = useState<Set<string>>(() => new Set());

    // Snapshot of "now" for this mount — the list doesn't need to tick live.
    const [now] = useState(() => Date.now());
    const upcoming = shifts
        .filter((s) => s.published && new Date(s.ends_at).getTime() > now)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const pendingIds = upcoming.filter((s) => !confirmedIds.has(s.id)).map((s) => s.id);
    // Only still-pending ids count as selected (a confirmed one drops out).
    const chosen = pendingIds.filter((id) => selected.has(id));
    const allChosen = pendingIds.length > 0 && chosen.length === pendingIds.length;

    const toggle = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const submit = () => confirm.mutate(chosen, { onSuccess: () => setSelected(new Set()) });

    return (
        <section className="glass rounded-2xl p-3">
            <header className="mb-2 flex items-center justify-between gap-2 px-1">
                <h2 className="flex items-center gap-1.5 text-card-title text-ink dark:text-white">
                    {t('confirm.upcoming')}
                    {pendingIds.length > 0 && (
                        <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                            {t('confirm.toConfirm', { n: pendingIds.length })}
                        </span>
                    )}
                </h2>
                {pendingIds.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => setSelected(allChosen ? new Set() : new Set(pendingIds))}>
                        {allChosen ? t('confirm.clearSelection') : t('confirm.selectAll')}
                    </Button>
                )}
            </header>

            {upcoming.length === 0 ? (
                <p className="px-1 py-2 text-meta text-ink-soft dark:text-slate-400">{t('confirm.none')}</p>
            ) : (
                <ul className="max-h-96 space-y-1 overflow-y-auto overscroll-contain pr-0.5">
                    {upcoming.map((s) => {
                        const d = new Date(s.starts_at);
                        const done = confirmedIds.has(s.id);
                        const on = selected.has(s.id);
                        const body = (
                            <>
                                {done ? (
                                    <span className="flex size-4.5 shrink-0 items-center justify-center text-emerald-600 dark:text-emerald-300">
                                        <LockSimpleIcon weight="fill" className="size-3.5" />
                                    </span>
                                ) : (
                                    <span
                                        aria-hidden
                                        className={`flex size-4.5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                                            on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-ink/25 dark:border-white/25'
                                        }`}
                                    >
                                        {on && <CheckIcon weight="bold" className="size-3" />}
                                    </span>
                                )}
                                <span className="flex h-9 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-ink/5 dark:bg-white/6">
                                    <span className="text-[13px] font-bold leading-none tabular-nums text-ink dark:text-white">{d.getDate()}</span>
                                    <span className="mt-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-ink-soft dark:text-slate-400">
                                        {weekdayShort(d)}
                                    </span>
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-meta font-semibold text-ink dark:text-white">{locationName(s.location_id)}</span>
                                    <span className="block text-caption tabular-nums text-ink-soft dark:text-slate-400">
                                        {s.all_day ? t('schedule.allDay') : `${formatTime(s.starts_at)}–${formatTime(s.ends_at)}`}
                                    </span>
                                </span>
                                {done && (
                                    <span className="shrink-0 text-meta font-semibold text-emerald-600 dark:text-emerald-300">{t('confirm.done')}</span>
                                )}
                            </>
                        );
                        const rowClass = `flex w-full items-center gap-2.5 rounded-xl p-1.5 pr-2.5 text-left ring-1 transition-colors ${
                            on
                                ? 'bg-emerald-500/8 ring-emerald-500/25 dark:bg-emerald-400/10'
                                : 'bg-white/55 ring-ink/5 dark:bg-white/4 dark:ring-white/6'
                        }`;
                        return (
                            <li key={s.id}>
                                {done ? (
                                    <div className={rowClass}>{body}</div>
                                ) : (
                                    <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(s.id)} className={`${rowClass} hover:bg-white/80 dark:hover:bg-white/8`}>
                                        {body}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {pendingIds.length > 0 && (
                <footer className="mt-2.5 flex items-center justify-between gap-3 px-1">
                    <p className="text-caption text-ink-soft dark:text-slate-400">{t('confirm.finalHint')}</p>
                    <Button size="sm" icon={CheckIcon} disabled={chosen.length === 0} loading={confirm.isPending} onClick={submit}>
                        {chosen.length > 0 ? t('confirm.selected', { n: chosen.length }) : t('confirm.action')}
                    </Button>
                </footer>
            )}
        </section>
    );
}
