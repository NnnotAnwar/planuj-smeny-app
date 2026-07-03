import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { XIcon, LightningIcon } from '@phosphor-icons/react';
import type { ScheduledShift } from '@shared/types';
import { weekdayShortLabels, formatTime } from '@shared/utils/date';
import { useTranslation } from '@shared/preferences/PreferencesContext';

/**
 * --- ROSTER GRID (the "spreadsheet" view) ---
 * One location's month as managers know it from Excel: a row per person, a
 * column per day, split into two 15-day bands (1–15 / 16–end) like the paper
 * rota. All-day assignments render as a ✓, timed ones as a compact start/end;
 * weekends and today are tinted. Managers tap a cell to toggle an all-day
 * assignment and can remove a member from the location's roster via the × next
 * to their name (rows with shifts this month stay visible regardless).
 */

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export interface RosterRow {
    id: string;
    name: string;
    /** Whether the current user may manage this person's assignments. */
    editable: boolean;
    /** Whether the person can be removed from this location's roster. */
    removable: boolean;
}

interface DayCol {
    num: number;
    key: string;
    label: string;
    weekend: boolean;
}

interface RosterGridProps {
    /** Selected month as `YYYY-MM`. */
    monthKey: string;
    rows: RosterRow[];
    /** This location's shifts for the month. */
    shifts: ScheduledShift[];
    canManage: boolean;
    onCellTap?: (memberId: string, date: string) => void;
    /** Restaurant quick-fill: alternate short (Wed+Thu) / long weeks. */
    onQuickFill?: (memberId: string, firstWeek: 'short' | 'long') => void;
    onRemoveRow?: (memberId: string) => void;
}

export function RosterGrid({ monthKey, rows, shifts, canManage, onCellTap, onQuickFill, onRemoveRow }: RosterGridProps) {
    const t = useTranslation();
    // Which member's quick-fill menu is open, and where (fixed coords so the
    // sticky/overflow table can't clip it).
    const [fillMenu, setFillMenu] = useState<{ id: string; left: number; top: number } | null>(null);
    useEffect(() => {
        if (!fillMenu) return;
        const close = () => setFillMenu(null);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [fillMenu]);
    const [year, month] = monthKey.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayKey = isoDate(new Date());
    const dayLabels = weekdayShortLabels(); // Mon-first

    // Two bands like the paper rota: 1–15 and 16–end.
    const bands = useMemo(() => {
        const all: DayCol[] = Array.from({ length: daysInMonth }, (_, i) => {
            const d = new Date(year, month - 1, i + 1);
            const dow = (d.getDay() + 6) % 7; // 0 = Monday
            return { num: i + 1, key: isoDate(d), label: dayLabels[dow], weekend: dow >= 5 };
        });
        return [all.slice(0, 15), all.slice(15)];
    }, [year, month, daysInMonth, dayLabels]);

    // member -> dayKey -> shifts
    const cellMap = useMemo(() => {
        const map = new Map<string, Map<string, ScheduledShift[]>>();
        for (const s of shifts) {
            const day = isoDate(new Date(s.starts_at));
            const inner = map.get(s.user_id) ?? new Map<string, ScheduledShift[]>();
            inner.set(day, [...(inner.get(day) ?? []), s]);
            map.set(s.user_id, inner);
        }
        return map;
    }, [shifts]);

    return (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {bands.map((days, bi) => (
                <div key={bi} className="overflow-x-auto emerald-scrollbar">
                    <table className="border-collapse text-center w-full">
                        <thead>
                            <tr>
                                <th className="sticky left-0 z-10 bg-white dark:bg-gray-900 border-b border-r border-gray-100 dark:border-gray-800 px-3 py-1.5 text-left text-micro text-gray-400 min-w-32 w-32" />
                                {days.map((d) => (
                                    <th
                                        key={d.key}
                                        className={`border-b border-gray-100 dark:border-gray-800 px-0.5 pt-1.5 pb-1 min-w-8 ${
                                            d.weekend ? 'bg-amber-50/70 dark:bg-amber-900/10' : ''
                                        }`}
                                    >
                                        <span className="block text-[9px] uppercase tracking-wide text-gray-400 leading-none">{d.label}</span>
                                        <span
                                            className={`mt-0.5 inline-flex items-center justify-center text-[11px] tabular-nums font-semibold leading-none ${
                                                d.key === todayKey
                                                    ? 'w-4.5 h-4.5 rounded-full bg-emerald-600 text-white'
                                                    : 'text-gray-600 dark:text-gray-300'
                                            }`}
                                        >
                                            {d.num}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => {
                                const memberDays = cellMap.get(row.id);
                                return (
                                    <tr key={row.id} className="group">
                                        <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60 border-b border-r border-gray-50 dark:border-gray-800/60 px-3 py-1.5 text-left whitespace-nowrap">
                                            <span className="flex items-center gap-1.5">
                                                <span className={`truncate text-small-strong ${row.editable ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                                                    {row.name}
                                                </span>
                                                {/* Row actions live on the first band only. */}
                                                {bi === 0 && canManage && row.editable && onQuickFill && (
                                                    <button
                                                        onClick={(e) => {
                                                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                            setFillMenu((prev) =>
                                                                prev?.id === row.id ? null : { id: row.id, left: r.left, top: r.bottom + 4 },
                                                            );
                                                        }}
                                                        title={t('schedule.quickFill')}
                                                        aria-label={t('schedule.quickFill')}
                                                        className="p-0.5 rounded text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <LightningIcon weight="fill" className="w-3 h-3" />
                                                    </button>
                                                )}
                                                {bi === 0 && canManage && row.removable && onRemoveRow && (
                                                    <button
                                                        onClick={() => onRemoveRow(row.id)}
                                                        title="×"
                                                        aria-label={`× ${row.name}`}
                                                        className="p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <XIcon weight="bold" className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </span>
                                        </td>
                                        {days.map((d) => {
                                            const items = memberDays?.get(d.key) ?? [];
                                            const has = items.length > 0;
                                            const allDay = has && items.every((s) => s.all_day);
                                            const tappable = canManage && row.editable && !!onCellTap;
                                            return (
                                                <td
                                                    key={d.key}
                                                    onClick={tappable ? () => onCellTap!(row.id, d.key) : undefined}
                                                    title={
                                                        has && !allDay
                                                            ? items.map((s) => `${formatTime(s.starts_at)}–${formatTime(s.ends_at)}`).join(', ')
                                                            : undefined
                                                    }
                                                    className={`border-b border-gray-50 dark:border-gray-800/60 h-8 px-0.5 align-middle select-none ${
                                                        d.weekend ? 'bg-amber-50/70 dark:bg-amber-900/10' : ''
                                                    } ${tappable ? 'cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/15 transition-colors' : ''}`}
                                                >
                                                    {has &&
                                                        (allDay ? (
                                                            <span className="inline-block w-5 h-5 rounded-md bg-emerald-500 text-white text-[11px] font-black leading-5">
                                                                ✓
                                                            </span>
                                                        ) : (
                                                            <span className="inline-block rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-[9px] font-bold px-1 py-0.5 leading-tight tabular-nums">
                                                                {formatTime(items[0].starts_at)}
                                                                <br />
                                                                {formatTime(items[0].ends_at)}
                                                            </span>
                                                        ))}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ))}

            {/* Quick-fill menu (fixed portal — the scrolling table can't clip it). */}
            {fillMenu &&
                onQuickFill &&
                createPortal(
                    <>
                        <div className="fixed inset-0 z-90" onClick={() => setFillMenu(null)} />
                        <div
                            style={{ position: 'fixed', left: fillMenu.left, top: fillMenu.top }}
                            className="z-100 w-64 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl py-1"
                        >
                            {([
                                { key: 'short' as const, label: t('schedule.shortWeekFirst') },
                                { key: 'long' as const, label: t('schedule.longWeekFirst') },
                            ]).map(({ key, label }) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => {
                                        onQuickFill(fillMenu.id, key);
                                        setFillMenu(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-small text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    <LightningIcon weight="fill" className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </>,
                    document.body,
                )}
        </div>
    );
}
