import { useState } from 'react';
import { HeartIcon, PlusIcon, ProhibitIcon, XIcon } from '@phosphor-icons/react';
import type { User } from '@shared/types';
import { Button } from '@shared/components/Button';
import { DatePicker } from '@shared/components/DatePicker';
import { TimePicker } from '@shared/components/TimePicker';
import { Input } from '@shared/components/Input';
import { FormError } from '@shared/components/FormError';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { formatDateLong, weekdayLong, weekdayShortLabels } from '@shared/utils/date';
import { useAvailability } from './useAvailability';
import { availabilityWindow } from './availabilityLogic';
import type { Availability } from './types';

/**
 * --- MY AVAILABILITY ---
 * A member tells their manager when they can't work (or would like to): either
 * every week on a weekday, or on one date, all day or for a time window. It's
 * advisory — the rota shows it while planning — unlike approved time off.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Small segmented switcher used by the form. */
function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
    return (
        <div className="segmented">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    aria-pressed={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={`rounded-[9px] px-2.5 py-1 text-meta font-semibold transition-colors ${
                        value === o.value ? 'segment-active text-ink dark:text-white' : 'text-ink-soft hover:text-ink dark:text-slate-400 dark:hover:text-white'
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export function AvailabilityCard({ user }: { user: User }) {
    const t = useTranslation();
    const { mine, create, remove } = useAvailability(user);

    const [open, setOpen] = useState(false);
    const [kind, setKind] = useState<'unavailable' | 'preferred'>('unavailable');
    const [target, setTarget] = useState<'weekly' | 'date'>('weekly');
    const [weekday, setWeekday] = useState(1); // JS day number, Monday
    const [date, setDate] = useState(todayISO);
    const [timed, setTimed] = useState(false);
    const [start, setStart] = useState('08:00');
    const [end, setEnd] = useState('12:00');
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);

    const reset = () => {
        setOpen(false);
        setTimed(false);
        setNote('');
        setError(null);
    };

    const submit = async () => {
        if (timed && end <= start) return setError(t('avail.badTime'));
        setError(null);
        await create.mutateAsync({
            kind,
            day_of_week: target === 'weekly' ? weekday : null,
            specific_date: target === 'date' ? date : null,
            all_day: !timed,
            start_time: timed ? start : null,
            end_time: timed ? end : null,
            note: note.trim() || null,
        });
        reset();
    };

    // Weekly rules first (Mon→Sun), then one-off dates (soonest first); past dates drop off.
    const entries = (mine.data ?? [])
        .filter((e) => !e.specific_date || e.specific_date >= todayISO())
        .sort((a, b) => {
            if (!a.specific_date !== !b.specific_date) return a.specific_date ? 1 : -1;
            if (a.specific_date && b.specific_date) return a.specific_date.localeCompare(b.specific_date);
            return (((a.day_of_week ?? 0) + 6) % 7) - (((b.day_of_week ?? 0) + 6) % 7);
        });

    const whenLabel = (e: Availability) =>
        e.specific_date ? formatDateLong(`${e.specific_date}T00:00`) : t('avail.weeklyOn', { day: weekdayLong(e.day_of_week ?? 0) });

    const dayLabels = weekdayShortLabels(); // Mon-first

    return (
        <section className="glass rounded-2xl p-3">
            <header className="flex items-start justify-between gap-3 px-1">
                <div className="min-w-0">
                    <h2 className="text-card-title text-ink dark:text-white">{t('avail.title')}</h2>
                    <p className="mt-0.5 text-caption text-ink-soft dark:text-slate-400">{t('avail.hint')}</p>
                </div>
                {!open && (
                    <Button size="sm" variant="tonal" icon={PlusIcon} onClick={() => setOpen(true)}>
                        {t('avail.add')}
                    </Button>
                )}
            </header>

            {open && (
                <div className="mt-3 space-y-2.5 rounded-xl bg-white/55 p-2.5 ring-1 ring-ink/5 dark:bg-white/4 dark:ring-white/6">
                    <div className="flex flex-wrap gap-2">
                        <Seg
                            value={kind}
                            onChange={setKind}
                            options={[
                                { value: 'unavailable', label: t('avail.unavailable') },
                                { value: 'preferred', label: t('avail.preferred') },
                            ]}
                        />
                        <Seg
                            value={target}
                            onChange={setTarget}
                            options={[
                                { value: 'weekly', label: t('avail.weekly') },
                                { value: 'date', label: t('avail.oneDay') },
                            ]}
                        />
                    </div>

                    {target === 'weekly' ? (
                        <div className="flex gap-1" role="radiogroup" aria-label={t('avail.weekday')}>
                            {dayLabels.map((label, i) => {
                                const dow = (i + 1) % 7; // Mon-first labels → JS day number
                                const on = weekday === dow;
                                return (
                                    <button
                                        key={label}
                                        type="button"
                                        role="radio"
                                        aria-checked={on}
                                        onClick={() => setWeekday(dow)}
                                        className={`h-8 flex-1 rounded-lg text-meta font-semibold capitalize transition-colors ${
                                            on
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-ink/5 text-ink-soft hover:text-ink dark:bg-white/6 dark:text-slate-400 dark:hover:text-white'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <DatePicker value={date} onChange={setDate} aria-label={t('avail.oneDay')} />
                    )}

                    <Seg
                        value={timed ? 'time' : 'all'}
                        onChange={(v) => setTimed(v === 'time')}
                        options={[
                            { value: 'all', label: t('schedule.allDay') },
                            { value: 'time', label: t('schedule.setTime') },
                        ]}
                    />
                    {timed && (
                        <div className="grid grid-cols-2 gap-2">
                            <TimePicker value={start} onChange={setStart} aria-label={t('shiftEditor.startTime')} />
                            <TimePicker value={end} onChange={setEnd} aria-label={t('shiftEditor.endTime')} />
                        </div>
                    )}

                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('avail.notePh')} maxLength={120} />
                    <FormError message={error} />

                    <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={reset}>
                            {t('common.cancel')}
                        </Button>
                        <Button size="sm" loading={create.isPending} onClick={() => void submit()}>
                            {t('common.save')}
                        </Button>
                    </div>
                </div>
            )}

            {entries.length === 0 ? (
                !open && <p className="mt-2 px-1 text-meta text-ink-soft dark:text-slate-400">{t('avail.empty')}</p>
            ) : (
                <ul className="mt-2.5 space-y-1">
                    {entries.map((e) => {
                        const cant = e.kind === 'unavailable';
                        const win = availabilityWindow(e);
                        return (
                            <li key={e.id} className="flex items-center gap-2.5 rounded-xl bg-white/55 p-1.5 pr-1 ring-1 ring-ink/5 dark:bg-white/4 dark:ring-white/6">
                                <span
                                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                                        cant ? 'bg-amber-500/12 text-amber-600 dark:text-amber-300' : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300'
                                    }`}
                                >
                                    {cant ? <ProhibitIcon weight="bold" className="size-4" /> : <HeartIcon weight="fill" className="size-4" />}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-meta font-semibold text-ink first-letter:uppercase dark:text-white">{whenLabel(e)}</span>
                                    <span className="block truncate text-caption text-ink-soft dark:text-slate-400">
                                        {[cant ? t('avail.unavailable') : t('avail.preferred'), win || t('schedule.allDay'), e.note].filter(Boolean).join(' · ')}
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => remove.mutate(e.id)}
                                    disabled={remove.isPending}
                                    aria-label={`${t('timeoff.withdraw')}: ${whenLabel(e)}`}
                                    title={t('timeoff.withdraw')}
                                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:text-slate-400"
                                >
                                    <XIcon weight="bold" className="size-3.5" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
