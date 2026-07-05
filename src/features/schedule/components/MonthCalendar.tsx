import { useMemo, useState } from 'react';
import { PlusIcon } from '@phosphor-icons/react';
import type { ScheduledShift } from '@shared/types';
import { weekdayShortLabels, formatTime, formatDateLong } from '@shared/utils/date';

/**
 * --- MONTH CALENDAR ---
 * A real month grid (Mon–Sun) for one rota. On sm+ shifts render as readable
 * chips inside their day; on phones (where 7 columns leave no room for text)
 * days show dots and tapping a day reveals its full details in a panel below
 * the grid. Managers tap a day to open the day editor and (on sm+) a chip to
 * edit a single assignment.
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
    /** Managers: tapping a day opens the day editor. */
    onDayClick?: (date: string) => void;
}

export function MonthCalendar({ monthKey, shifts, chipLabel, canManage, onDayClick }: MonthCalendarProps) {
    const [year, month] = monthKey.split('-').map(Number);
    // Read-only (member) mobile view: the tapped day whose details show below.
    const [selectedDay, setSelectedDay] = useState<string | null>(null);

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
    const chipText = (s: ScheduledShift) => (s.all_day ? chipLabel(s) : `${formatTime(s.starts_at)} ${chipLabel(s)}`);
    const selectedItems = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

    const handleDayTap = (key: string, inMonth: boolean, hasItems: boolean) => {
        if (!inMonth) return;
        if (canManage) {
            onDayClick?.(key);
            return;
        }
        // Member view: toggle the details panel (only for days with shifts).
        setSelectedDay((prev) => (prev === key ? null : hasItems ? key : null));
    };

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
                        const isSelected = key === selectedDay;
                        const tappable = inMonth && (canManage ? !!onDayClick : items.length > 0);
                        return (
                            <div
                                key={key}
                                onClick={tappable ? () => handleDayTap(key, inMonth, items.length > 0) : undefined}
                                className={`group relative min-h-12 sm:min-h-20 border-r border-gray-50 dark:border-gray-800/60 last:border-r-0 p-0.5 sm:p-1 flex flex-col gap-0.5 ${
                                    inMonth ? '' : 'bg-gray-50/60 dark:bg-gray-900/40'
                                } ${isSelected ? 'bg-emerald-50/70 dark:bg-emerald-900/15' : ''} ${
                                    tappable ? 'cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors' : ''
                                }`}
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
                                    {canManage && inMonth && (
                                        <PlusIcon weight="bold" className="hidden sm:block w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                </div>

                                {/* PHONE: dots — full details live in the panel below / day editor. */}
                                {items.length > 0 && (
                                    <div className="flex sm:hidden flex-wrap items-center gap-0.5 px-0.5">
                                        {items.slice(0, 4).map((s) => (
                                            <span key={s.id} className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        ))}
                                        {items.length > 4 && (
                                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 leading-none">
                                                +{items.length - 4}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* SM+: readable chips (display only — the day itself is the tap target). */}
                                <div className="hidden sm:flex sm:flex-col gap-0.5">
                                    {items.map((s) => (
                                        <span
                                            key={s.id}
                                            className={`w-full rounded-lg bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 px-1 py-0.5 leading-tight ${s.published ? '' : 'opacity-50'}`}
                                        >
                                            <span className="block truncate text-[11px] font-semibold tabular-nums">{chipText(s)}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}

            {/* PHONE: selected-day details (read-only view). */}
            {!canManage && selectedDay && selectedItems.length > 0 && (
                <div className="sm:hidden border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-1.5">
                    <p className="text-label text-gray-400">{formatDateLong(`${selectedDay}T00:00`)}</p>
                    {selectedItems.map((s) => (
                        <p key={s.id} className="text-small-strong text-gray-900 dark:text-white">
                            {s.all_day ? chipLabel(s) : `${formatTime(s.starts_at)}–${formatTime(s.ends_at)} · ${chipLabel(s)}`}
                            {s.note && <span className="block text-caption font-normal text-gray-400">{s.note}</span>}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}
