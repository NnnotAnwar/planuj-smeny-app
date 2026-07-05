import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarBlankIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useAuthContext } from '@features/auth/AuthContext';
import { useShiftContext } from '@features/shifts/ShiftContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { formatTime, formatDateLong } from '@shared/utils/date';
import { scheduleService } from '../scheduleService';

/**
 * --- NEXT SHIFT CARD (dashboard) ---
 * The member's next rostered shift within a week — date, time (or all-day) and
 * location — right on the home screen, linking to the full schedule.
 */
export function NextShiftCard() {
    const { user } = useAuthContext();
    const { locations } = useShiftContext();
    const t = useTranslation();

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

    return (
        <Link
            to="/schedule"
            className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/60 dark:bg-emerald-900/10 px-4 py-3 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/20 transition-colors"
        >
            <span className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CalendarBlankIcon weight="fill" className="w-4 h-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-micro text-emerald-600 dark:text-emerald-400">{t('schedule.nextShift')}</span>
                <span className="block text-small-strong text-gray-900 dark:text-white truncate">
                    {when} · {time} · {locName}
                </span>
            </span>
            <CaretRightIcon weight="bold" className="w-4 h-4 text-emerald-500 shrink-0" />
        </Link>
    );
}
