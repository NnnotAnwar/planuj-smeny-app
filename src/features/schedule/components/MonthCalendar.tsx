import { useMemo } from 'react';
import { PlusIcon } from '@phosphor-icons/react';
import type { ScheduledShift } from '@shared/types';
import { weekdayShortLabels, formatTime } from '@shared/utils/date';

/**
 * --- MONTH CALENDAR ---
 * A real month grid (Mon–Sun) for one rota: shifts appear as compact chips
 * inside their day. Managers click an empty day to plan a shift there and a
 * chip to edit it; for members the grid is read-only.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

interface MonthCalendarProps {
    /** Selected month as `YYYY-MM`. */
    monthKey: string;
    shifts: ScheduledShift[];
    /** Chip text next to the start time (member name in team view, location in mine). */
    chipLabel: (s: ScheduledShift) => string;
    canManage: boolean;
    onDayClick?: (date: string) => void;
    onShiftClick?: (s: ScheduledShift) => void;
}

export function MonthCalendar({ monthKey, shifts, chipLabel, canManage, onDayClick, onShiftClick }: MonthCalendarProps) {
    const [year, month] = monthKey.split('-').map(Number);

    // Grid = full weeks (Mon-first) covering the month.
    const weeks = useMemo(() => {
        const first = new Date(year, month - 1, 1);
        const start = new Date(first);
        start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
        const out: Date[][] = [];
        const cursor = new Date(start);
        do {
            const week: Date[] = [];
            for (let i = 0; i < 7; i++) {
                week.push(new Date(cursor));
                cursor.setDate(cursor.getDate() + 1);
            }
            out.push(week);
        } while (cursor.getMonth() === month - 1);
        return out;
    }, [year, month]);

    // Shifts bucketed by local day, ordered by start time.
    const byDay = useMemo(() => {
        const map = new Map<string, ScheduledShift[]>();
        for (const s of [...shifts].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
            const key = isoDate(new Date(s.starts_at));
            map.set(key, [...(map.get(key) ?? []), s]);
        }
        return map;
    }, [shifts]);

    const todayKey = isoDate(new Date());
    const dayLabels = weekdayShortLabels();

    return (
        <div className="select-none">
            {/* Weekday header */}
            <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
                {dayLabels.map((d) => (
                    <div key={d} className="py-1.5 text-center text-micro text-gray-400">{d}</div>
                ))}
            </div>

            {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b border-gray-50 dark:border-gray-800/60 last:border-b-0">
                    {week.map((day) => {
                        const inMonth = day.getMonth() === month - 1;
                        const key = isoDate(day);
                        const items = inMonth ? (byDay.get(key) ?? []) : [];
                        const isToday = key === todayKey;
                        const clickable = canManage && inMonth && !!onDayClick;
                        return (
                            <div
                                key={key}
                                onClick={clickable ? () => onDayClick!(key) : undefined}
                                className={`group relative min-h-14 sm:min-h-20 border-r border-gray-50 dark:border-gray-800/60 last:border-r-0 p-0.5 sm:p-1 flex flex-col gap-0.5 ${
                                    inMonth ? '' : 'bg-gray-50/60 dark:bg-gray-900/40'
                                } ${clickable ? 'cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors' : ''}`}
                            >
                                <div className="flex items-center justify-between px-0.5">
                                    <span
                                        className={`text-micro tabular-nums ${
                                            !inMonth
                                                ? 'text-gray-300 dark:text-gray-700'
                                                : isToday
                                                  ? 'w-4.5 h-4.5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold'
                                                  : 'text-gray-400'
                                        }`}
                                    >
                                        {day.getDate()}
                                    </span>
                                    {clickable && (
                                        <PlusIcon weight="bold" className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                </div>
                                {items.map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        disabled={!canManage || !onShiftClick}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onShiftClick?.(s);
                                        }}
                                        className={`w-full text-left rounded-md sm:rounded-lg bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 px-1 py-0.5 leading-tight ${
                                            canManage && onShiftClick ? 'hover:bg-emerald-200/80 dark:hover:bg-emerald-900/50 transition-colors' : 'cursor-default'
                                        }`}
                                    >
                                        <span className="block truncate text-[10px] sm:text-[11px] font-semibold tabular-nums">
                                            {formatTime(s.starts_at)} {chipLabel(s)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
