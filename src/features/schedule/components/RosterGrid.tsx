import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { XIcon, LightningIcon, EraserIcon } from '@phosphor-icons/react';
import type { ScheduledShift } from '@shared/types';
import { weekdayShortLabels, formatTime } from '@shared/utils/date';
import { useTranslation } from '@shared/preferences/PreferencesContext';

/**
 * --- ROSTER GRID (the "spreadsheet" view) ---
 * One location's month: a row per person, a column per day, split into two
 * bands (1–15 / 16–end) like the paper rota. Columns are FIXED-width so both
 * bands line up perfectly (auto layout used to stretch 15 vs 16 columns
 * differently). Both bands share one horizontal scroll container; the name
 * column is sticky. Weekends and today are tinted, rows are zebra-striped.
 *
 * Row actions (hover / always visible on touch): the lightning menu fills the
 * month with the restaurant short/long-week pattern (replacing the previous
 * pattern) or clears the member's month here; the × removes the member from
 * this location entirely.
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

export type QuickFillAction = 'short' | 'long' | 'clear';

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
    /** The location's short letter (paper-rota style) — replaces the ✓ when set. */
    code?: string | null;
    canManage: boolean;
    onCellTap?: (memberId: string, date: string) => void;
    /** Restaurant quick-fill / clear for one member's month at this location. */
    onQuickFill?: (memberId: string, action: QuickFillAction) => void;
    onRemoveRow?: (memberId: string) => void;
}

/** Mini week visual for the fill menu: 7 boxes, pattern days filled. */
function WeekPreview({ days, tone }: { days: number[]; tone: 'sky' | 'emerald' }) {
    const on = new Set(days);
    const fill = tone === 'sky' ? 'bg-sky-500' : 'bg-emerald-500';
    return (
        <span className="flex gap-0.5 shrink-0">
            {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className={`w-2 h-3 rounded-xs ${on.has(i) ? fill : 'bg-gray-200 dark:bg-gray-600'}`} />
            ))}
        </span>
    );
}

export function RosterGrid({ monthKey, rows, shifts, code, canManage, onCellTap, onQuickFill, onRemoveRow }: RosterGridProps) {
    const t = useTranslation();
    const [fillMenu, setFillMenu] = useState<{ id: string; name: string; left: number; top: number } | null>(null);

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

    // Two bands like the paper rota: 1–15 and 16–end. Both bands render the
    // same number of columns (the shorter one padded with blanks), so with
    // table-fixed + w-full the day columns of both bands line up exactly while
    // the table still fills the card.
    const { bands, maxCols } = useMemo(() => {
        const all: DayCol[] = Array.from({ length: daysInMonth }, (_, i) => {
            const d = new Date(year, month - 1, i + 1);
            const dow = (d.getDay() + 6) % 7; // 0 = Monday
            return { num: i + 1, key: isoDate(d), label: dayLabels[dow], weekend: dow >= 5 };
        });
        const split = [all.slice(0, 15), all.slice(15)];
        return { bands: split, maxCols: Math.max(split[0].length, split[1].length) };
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

    const NAME_W = 'w-32 min-w-32 max-w-32 sm:w-40 sm:min-w-40 sm:max-w-40';
    // Blank columns pad the shorter band so day columns line up across bands.
    const blanksFor = (count: number) => Array.from({ length: Math.max(0, maxCols - count) });

    return (
        <div>
            {/* One scroll container for both bands; each table is full-width with
                table-fixed + equal (padded) column counts, so it fills the card
                on desktop while both bands stay perfectly aligned. */}
            <div className="overflow-x-auto emerald-scrollbar">
                <div className="min-w-2xl">
                    {bands.map((days, bi) => (
                        <table key={bi} className={`w-full border-collapse text-center table-fixed ${bi > 0 ? 'border-t-4 border-gray-100 dark:border-gray-800' : ''}`}>
                            <thead>
                                <tr className="bg-gray-50/80 dark:bg-gray-800/40">
                                    <th className={`sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-r border-gray-100 dark:border-gray-700 px-3 py-1 text-left ${NAME_W}`} />
                                    {days.map((d) => (
                                        <th
                                            key={d.key}
                                            className={`border-b border-l border-gray-100 dark:border-gray-800 px-0 pt-1.5 pb-1 ${
                                                d.weekend ? 'bg-amber-100/60 dark:bg-amber-900/15' : ''
                                            }`}
                                        >
                                            <span className="block text-[9px] uppercase tracking-wide text-gray-400 leading-none">{d.label}</span>
                                            <span
                                                className={`mt-0.5 inline-flex items-center justify-center text-[11px] tabular-nums font-bold leading-none ${
                                                    d.key === todayKey
                                                        ? 'w-4.5 h-4.5 rounded-full bg-emerald-600 text-white'
                                                        : 'text-gray-600 dark:text-gray-300'
                                                }`}
                                            >
                                                {d.num}
                                            </span>
                                        </th>
                                    ))}
                                    {blanksFor(days.length).map((_, i) => (
                                        <th key={`b${i}`} className="border-b border-gray-100 dark:border-gray-800" />
                                    ))}
                                    {/* Month total per person — rendered on the second band only. */}
                                    <th className={`border-b border-l border-gray-100 dark:border-gray-800 px-0 pt-1.5 pb-1 w-10 min-w-10 ${bi === 0 ? 'opacity-0' : ''}`}>
                                        <span className="text-[10px] font-bold text-gray-400">Σ</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, ri) => {
                                    const memberDays = cellMap.get(row.id);
                                    const zebra = ri % 2 === 1 ? 'bg-gray-50/60 dark:bg-gray-800/20' : '';
                                    return (
                                        <tr key={row.id} className="group">
                                            <td className={`sticky left-0 z-10 bg-white dark:bg-gray-900 border-b border-r border-gray-100 dark:border-gray-700 px-3 h-9 text-left ${NAME_W}`}>
                                                <span className="flex items-center gap-1">
                                                    <span className={`truncate text-[12px] font-semibold ${row.editable ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                                                        {row.name}
                                                    </span>
                                                    {/* Row actions once, on the first band. Always visible on
                                                        touch (no hover there); revealed on hover for mouse. */}
                                                    {bi === 0 && canManage && row.editable && onQuickFill && (
                                                        <button
                                                            onClick={(e) => {
                                                                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                                setFillMenu((prev) =>
                                                                    prev?.id === row.id ? null : { id: row.id, name: row.name, left: r.left, top: r.bottom + 4 },
                                                                );
                                                            }}
                                                            title={t('schedule.quickFill')}
                                                            aria-label={t('schedule.quickFill')}
                                                            className="ml-auto p-1 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                                                        >
                                                            <LightningIcon weight="fill" className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {bi === 0 && canManage && row.removable && onRemoveRow && (
                                                        <button
                                                            onClick={() => onRemoveRow(row.id)}
                                                            title={t('schedule.removeTitle')}
                                                            aria-label={`${t('schedule.removeTitle')}: ${row.name}`}
                                                            className={`${onQuickFill && row.editable ? '' : 'ml-auto '}p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors sm:opacity-0 sm:group-hover:opacity-100`}
                                                        >
                                                            <XIcon weight="bold" className="w-3.5 h-3.5" />
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
                                                        className={`border-b border-l border-gray-100 dark:border-gray-800 h-9 px-0 align-middle select-none ${zebra} ${
                                                            d.weekend ? 'bg-amber-100/60 dark:bg-amber-900/15' : ''
                                                        } ${tappable ? 'cursor-pointer hover:bg-emerald-100/70 dark:hover:bg-emerald-900/25 transition-colors' : ''}`}
                                                    >
                                                        {has &&
                                                            (allDay ? (
                                                                <span className="inline-block w-5.5 h-5.5 rounded-lg bg-emerald-500 text-white text-[11px] font-black leading-5.5 shadow-sm shadow-emerald-500/30">
                                                                    {code || '✓'}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-block rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-[9px] font-bold px-0.5 py-0.5 leading-[1.15] tabular-nums">
                                                                    {formatTime(items[0].starts_at)}
                                                                    <br />
                                                                    {formatTime(items[0].ends_at)}
                                                                </span>
                                                            ))}
                                                    </td>
                                                );
                                            })}
                                            {blanksFor(days.length).map((_, i) => (
                                                <td key={`b${i}`} className={`border-b border-gray-100 dark:border-gray-800 h-9 ${zebra}`} />
                                            ))}
                                            <td className={`border-b border-l border-gray-100 dark:border-gray-800 h-9 ${zebra} ${bi === 0 ? 'opacity-0' : ''}`}>
                                                <span className="text-[11px] font-bold tabular-nums text-gray-500 dark:text-gray-400">
                                                    {(memberDays ? [...memberDays.values()].flat().length : 0) || ''}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ))}
                </div>
            </div>

            {/* Quick-fill menu (fixed portal — the scrolling table can't clip it). */}
            {fillMenu &&
                onQuickFill &&
                createPortal(
                    <>
                        <div className="fixed inset-0 z-90" onClick={() => setFillMenu(null)} />
                        <div
                            style={{ position: 'fixed', left: fillMenu.left, top: fillMenu.top }}
                            className="z-100 w-72 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl py-1"
                        >
                            <p className="px-3 pt-1.5 pb-1 text-micro text-gray-400 truncate">{fillMenu.name}</p>
                            {/* Choosing a pattern REPLACES the member's all-day fills here. */}
                            <button
                                type="button"
                                onClick={() => {
                                    onQuickFill(fillMenu.id, 'short');
                                    setFillMenu(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-small text-gray-700 dark:text-gray-200 hover:bg-sky-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <WeekPreview days={[2, 3]} tone="sky" />
                                <span className="flex-1">{t('schedule.shortWeekFirst')}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onQuickFill(fillMenu.id, 'long');
                                    setFillMenu(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-small text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <WeekPreview days={[0, 1, 4, 5, 6]} tone="emerald" />
                                <span className="flex-1">{t('schedule.longWeekFirst')}</span>
                            </button>
                            <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                            <button
                                type="button"
                                onClick={() => {
                                    onQuickFill(fillMenu.id, 'clear');
                                    setFillMenu(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-small text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/15 transition-colors"
                            >
                                <EraserIcon weight="bold" className="w-4 h-4 shrink-0" />
                                {t('schedule.clearPerson')}
                            </button>
                        </div>
                    </>,
                    document.body,
                )}
        </div>
    );
}
