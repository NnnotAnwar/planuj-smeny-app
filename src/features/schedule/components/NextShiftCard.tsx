import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarBlankIcon, CaretRightIcon, CheckCircleIcon } from '@phosphor-icons/react';
import { useAuthContext } from '@features/auth/AuthContext';
import { useShiftContext } from '@features/shifts/ShiftContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { formatTime, formatDateLong } from '@shared/utils/date';
import { scheduleService } from '../scheduleService';
import { useShiftConfirmations } from '../confirmation/useShiftConfirmations';

/**
 * --- NEXT SHIFT CARD (dashboard) ---
 * The member's next rostered shift within a week — date, time (or all-day) and
 * location — right on the home screen, linking to the full schedule. A
 * published shift can be confirmed ("Got it") right here.
 */
export function NextShiftCard() {
    const { user } = useAuthContext();
    const { locations } = useShiftContext();
    const t = useTranslation();
    const { confirmedIds, confirm } = useShiftConfirmations(user);

    const q = useQuery({
        queryKey: ['next-shift', user?.id],
        enabled: !!user,
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            const now = new Date();
            const horizon = new Date(now);
            horizon.setDate(horizon.getDate() + 7);
            const all = await scheduleService.getRange(
                new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
                horizon.toISOString(),
            );
            const mine = all
                .filter((s) => s.user_id === user!.id && new Date(s.ends_at).getTime() > Date.now())
                .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
            return mine[0] ?? null;
        },
    });

    const next = q.data;
    if (!next) return null;

    const locName = next.location_id
        ? locations.find((l) => l.id === next.location_id)?.name ?? '—'
        : t('schedule.noLocation');
    const isToday = new Date(next.starts_at).toDateString() === new Date().toDateString();
    const when = isToday ? t('common.today') : formatDateLong(next.starts_at);
    const time = next.all_day ? t('schedule.allDay') : `${formatTime(next.starts_at)}–${formatTime(next.ends_at)}`;

    const confirmed = confirmedIds.has(next.id);

    return (
        <div className="glass group mb-3 flex items-center gap-2.5 rounded-xl px-3 py-2 transition-transform duration-200 hover:-translate-y-px">
        <Link to="/schedule" className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
                <CalendarBlankIcon weight="duotone" className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-eyebrow text-ink-soft dark:text-slate-400">{t('schedule.nextShift')}</span>
                <span className="mt-0.5 block truncate text-meta font-semibold text-ink dark:text-white">
                    {when} · {time} · {locName}
                </span>
            </span>
            <CaretRightIcon
                weight="bold"
                className="size-3.5 shrink-0 text-ink-soft transition-transform duration-200 group-hover:translate-x-0.5 dark:text-slate-400"
            />
        </Link>
        {next.published &&
            (confirmed ? (
                <span className="flex shrink-0 items-center gap-1 text-meta font-semibold text-emerald-600 dark:text-emerald-300">
                    <CheckCircleIcon weight="fill" className="size-4" />
                    <span className="hidden sm:inline">{t('confirm.done')}</span>
                </span>
            ) : (
                <button
                    type="button"
                    onClick={() => confirm.mutate([next.id])}
                    disabled={confirm.isPending}
                    className="shrink-0 rounded-lg bg-emerald-500/12 px-2.5 py-1 text-meta font-semibold text-emerald-700 ring-1 ring-emerald-500/20 transition-colors hover:bg-emerald-500/20 disabled:opacity-60 dark:text-emerald-300"
                >
                    {t('confirm.action')}
                </button>
            ))}
        </div>
    );
}
