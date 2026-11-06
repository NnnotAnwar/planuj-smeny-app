import { useState } from 'react';
import { ArrowsLeftRightIcon, HourglassMediumIcon } from '@phosphor-icons/react';
import type { User } from '@shared/types';
import { Button } from '@shared/components/Button';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { formatTime, weekdayShort } from '@shared/utils/date';
import { useShiftSwaps } from './useShiftSwaps';
import { personName, type ShiftSwap } from './types';

/**
 * --- SWAP OFFERS ---
 * Shifts colleagues offered: take one in a tap (the server checks you're free).
 * Shifts you took wait here for an admin's approval; you can give them back.
 * Hidden when there's nothing to show.
 */
export function SwapOffersCard({ user, locationName }: { user: User; locationName: (id: string | null) => string }) {
    const t = useTranslation();
    const { swaps, take, withdraw } = useShiftSwaps(user);
    const [now] = useState(() => Date.now());

    const upcoming = (s: ShiftSwap) => !!s.shift && new Date(s.shift.starts_at).getTime() > now;
    const offers = swaps.filter(
        (s) => s.status === 'open' && s.from_user !== user.id && (!s.to_user || s.to_user === user.id) && upcoming(s),
    );
    const mineTaken = swaps.filter((s) => s.status === 'taken' && s.taker_id === user.id && upcoming(s));
    if (offers.length === 0 && mineTaken.length === 0) return null;

    const row = (s: ShiftSwap, action: React.ReactNode, sub: string) => {
        const d = new Date(s.shift!.starts_at);
        return (
            <li key={s.id} className="flex items-center gap-2.5 rounded-xl bg-white/55 p-1.5 pr-2 ring-1 ring-ink/5 dark:bg-white/4 dark:ring-white/6">
                <span className="flex h-9 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-ink/5 dark:bg-white/6">
                    <span className="text-[13px] font-bold leading-none tabular-nums text-ink dark:text-white">{d.getDate()}</span>
                    <span className="mt-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-ink-soft dark:text-slate-400">{weekdayShort(d)}</span>
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-meta font-semibold text-ink dark:text-white">
                        {locationName(s.shift!.location_id)} ·{' '}
                        <span className="tabular-nums">
                            {s.shift!.all_day ? t('schedule.allDay') : `${formatTime(s.shift!.starts_at)}–${formatTime(s.shift!.ends_at)}`}
                        </span>
                    </span>
                    <span className="block truncate text-caption text-ink-soft dark:text-slate-400">{sub}</span>
                </span>
                {action}
            </li>
        );
    };

    return (
        <section className="glass rounded-2xl p-3">
            <header className="mb-2 flex items-center gap-1.5 px-1">
                <ArrowsLeftRightIcon weight="bold" className="size-4 text-emerald-600 dark:text-emerald-300" />
                <h2 className="text-card-title text-ink dark:text-white">{t('swap.title')}</h2>
            </header>
            <ul className="space-y-1">
                {mineTaken.map((s) =>
                    row(
                        s,
                        <Button size="sm" variant="ghost" loading={withdraw.isPending && withdraw.variables === s.id} onClick={() => withdraw.mutate(s.id)}>
                            {t('swap.giveBack')}
                        </Button>,
                        `${t('swap.waiting')} · ${t('swap.from', { name: personName(s.from) })}`,
                    ),
                )}
                {offers.map((s) =>
                    row(
                        s,
                        <Button size="sm" variant="tonal" loading={take.isPending && take.variables === s.id} onClick={() => take.mutate(s.id)}>
                            {t('swap.take')}
                        </Button>,
                        [t('swap.from', { name: personName(s.from) }), s.note].filter(Boolean).join(' · '),
                    ),
                )}
            </ul>
            {mineTaken.length > 0 && (
                <p className="mt-2 flex items-center gap-1 px-1 text-caption text-ink-soft dark:text-slate-400">
                    <HourglassMediumIcon weight="bold" className="size-3.5" />
                    {t('swap.waitingHint')}
                </p>
            )}
        </section>
    );
}
