import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { TrendUpIcon } from '@phosphor-icons/react';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { monthLong } from '@shared/utils/date';
import { fmtHours } from '../shiftStats';

/**
 * --- MONTH PACE (Overview) ---
 * Running total of net hours through the month, against last month's running
 * total — one glance says "ahead / behind last month, and by how much".
 *
 * Dataviz rules followed: 2px lines with round joins, a ~10% area wash under
 * the series that matters, hairline solid gridlines, an end-dot with a surface
 * ring, direct end labels + a legend (two series), a crosshair tooltip that
 * lists both months, keyboard-steppable, and a screen-reader table. Colours
 * were run through the palette validator for every scheme: accent-700 (light)
 * / accent-500 (dark) against the grey reference line.
 */

const H = 150; // plot + axis height (px)
const PAD = { top: 12, right: 46, bottom: 20, left: 30 };

const cumulative = (daily: number[]) => {
    let sum = 0;
    return daily.map((h) => (sum += h));
};

/**
 * Monotone cubic path through points (Fritsch–Carlson, as d3's curveMonotoneX):
 * smooth, but never overshoots — a running total must never appear to dip.
 */
function monotonePath(pts: [number, number][]): string {
    const n = pts.length;
    if (n === 0) return '';
    if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
    const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
    const slope = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / (dx[i] || 1));
    const tan = pts.map((_, i) => {
        if (i === 0) return slope[0];
        if (i === n - 1) return slope[n - 2];
        const a0 = slope[i - 1];
        const a1 = slope[i];
        if (a0 * a1 <= 0) return 0;
        return (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / a0 + (dx[i] + 2 * dx[i - 1]) / a1);
    });
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
        const h = dx[i] / 3;
        d += `C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + h * tan[i]).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${(pts[i + 1][1] - h * tan[i + 1]).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
    }
    return d;
}

/** A tidy axis top: 5 / 10 / 20 h steps. */
function niceMax(v: number): { max: number; step: number } {
    const step = v > 120 ? 40 : v > 60 ? 20 : v > 24 ? 10 : 5;
    return { max: Math.max(step, Math.ceil((v * 1.08) / step) * step), step };
}

export function MonthPaceChart({
    monthKey,
    daily,
    prevDaily,
    lastDayIndex,
}: {
    monthKey: string; // YYYY-MM
    daily: number[]; // this month, index 0 = the 1st
    prevDaily: number[] | null; // last month, or null when there's nothing to compare
    /** Draw this month only up to here (today, for the month still running). */
    lastDayIndex: number;
}) {
    const t = useTranslation();
    const wrapRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [hover, setHover] = useState<number | null>(null);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const [y, m] = monthKey.split('-').map(Number);
    const thisName = monthLong(new Date(y, m - 1, 1));
    const prevName = monthLong(new Date(y, m - 2, 1));

    const cur = cumulative(daily).slice(0, lastDayIndex + 1);
    const prev = prevDaily ? cumulative(prevDaily) : null;
    const days = Math.max(daily.length, prev?.length ?? 0);
    const top = niceMax(Math.max(cur[cur.length - 1] ?? 0, prev?.[prev.length - 1] ?? 0, 1));

    const plotW = Math.max(0, width - PAD.left - PAD.right);
    const plotH = H - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (days > 1 ? (i / (days - 1)) * plotW : 0);
    const yv = (v: number) => PAD.top + plotH - (v / top.max) * plotH;
    const line = (pts: number[]) => monotonePath(pts.map((v, i) => [x(i), yv(v)]));
    const area = (pts: number[]) =>
        `${line(pts)}L${x(pts.length - 1).toFixed(1)},${yv(0).toFixed(1)}L${x(0).toFixed(1)},${yv(0).toFixed(1)}Z`;

    const ticks = [0, top.max / 2, top.max];
    const xTicks = [1, 8, 15, 22, 29].filter((d) => d <= days);

    // End labels: nudge apart when the two totals land on top of each other.
    const curEnd = { x: x(cur.length - 1), y: yv(cur[cur.length - 1] ?? 0), v: cur[cur.length - 1] ?? 0 };
    const prevEnd = prev ? { x: x(prev.length - 1), y: yv(prev[prev.length - 1]), v: prev[prev.length - 1] } : null;
    let curLabelY = curEnd.y;
    let prevLabelY = prevEnd?.y ?? 0;
    if (prevEnd && Math.abs(curLabelY - prevLabelY) < 13 && Math.abs(curEnd.x - prevEnd.x) < 40) {
        const mid = (curLabelY + prevLabelY) / 2;
        const up = curLabelY <= prevLabelY;
        curLabelY = mid + (up ? -7 : 7);
        prevLabelY = mid + (up ? 7 : -7);
    }

    const pick = (clientX: number) => {
        const rect = wrapRef.current?.getBoundingClientRect();
        if (!rect || plotW <= 0) return;
        const i = Math.round(((clientX - rect.left - PAD.left) / plotW) * (days - 1));
        setHover(Math.min(days - 1, Math.max(0, i)));
    };
    const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        setHover((h) => Math.min(days - 1, Math.max(0, (h ?? lastDayIndex) + (e.key === 'ArrowRight' ? 1 : -1))));
    };

    const hv = hover !== null ? { cur: cur[hover], prev: prev?.[hover] } : null;
    const tipLeft = hover !== null ? x(hover) : 0;
    const tipFlip = tipLeft > width - 150;

    return (
        <div className="glass rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h2 className="flex items-center gap-1.5 text-label text-ink-soft dark:text-slate-400">
                    <TrendUpIcon weight="bold" className="size-3.5 text-emerald-700 dark:text-emerald-400" /> {t('overview.pace')}
                </h2>
                {prev && (
                    <span className="flex items-center gap-3 text-caption text-ink-soft dark:text-slate-400">
                        <span className="flex items-center gap-1.5">
                            <span className="h-0.5 w-3 rounded-full bg-emerald-700 dark:bg-emerald-500" /> <span className="capitalize">{thisName}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="h-0.5 w-3 rounded-full bg-gray-400 dark:bg-gray-500" /> <span className="capitalize">{prevName}</span>
                        </span>
                    </span>
                )}
            </div>

            <div ref={wrapRef} className="relative mt-2" style={{ height: H }}>
                {width > 0 && (
                    <svg
                        width={width}
                        height={H}
                        role="img"
                        aria-label={t('overview.pace')}
                        tabIndex={0}
                        onPointerMove={(e: PointerEvent) => pick(e.clientX)}
                        onPointerLeave={() => setHover(null)}
                        onKeyDown={onKey}
                        onBlur={() => setHover(null)}
                        className="block touch-pan-y overflow-visible text-emerald-700 outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:text-emerald-500"
                    >
                        <defs>
                            <linearGradient id="pace-wash" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
                                <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                            </linearGradient>
                        </defs>

                        {/* Gridlines + y labels (hairline, solid, recessive). */}
                        {ticks.map((v) => (
                            <g key={v}>
                                <line x1={PAD.left} x2={PAD.left + plotW} y1={yv(v)} y2={yv(v)} className="stroke-ink/8 dark:stroke-white/8" strokeWidth={1} />
                                <text x={PAD.left - 6} y={yv(v)} dy="0.32em" textAnchor="end" className="fill-ink-soft text-[10px] tabular-nums dark:fill-slate-500">
                                    {v}h
                                </text>
                            </g>
                        ))}
                        {xTicks.map((d) => (
                            <text key={d} x={x(d - 1)} y={H - 5} textAnchor="middle" className="fill-ink-soft text-[10px] tabular-nums dark:fill-slate-500">
                                {d}.
                            </text>
                        ))}

                        {/* Last month: the grey reference line. */}
                        {prev && (
                            <path d={line(prev)} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="stroke-gray-400 dark:stroke-gray-500" />
                        )}

                        {/* This month: wash + line + end-dot. */}
                        {cur.length > 0 && (
                            <>
                                <path d={area(cur)} fill="url(#pace-wash)" />
                                <path d={line(cur)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx={curEnd.x} cy={curEnd.y} r={4} fill="currentColor" strokeWidth={2} className="stroke-white dark:stroke-gray-900" />
                            </>
                        )}

                        {/* Direct end labels (values in ink, never the series colour). */}
                        {cur.length > 0 && (
                            <text x={curEnd.x + 8} y={curLabelY} dy="0.32em" className="fill-ink text-[11px] font-semibold tabular-nums dark:fill-white">
                                {fmtHours(curEnd.v)}
                            </text>
                        )}
                        {prevEnd && (
                            <text x={prevEnd.x + 8} y={prevLabelY} dy="0.32em" className="fill-ink-soft text-[11px] font-medium tabular-nums dark:fill-slate-400">
                                {fmtHours(prevEnd.v)}
                            </text>
                        )}

                        {/* Crosshair. */}
                        {hover !== null && (
                            <g pointerEvents="none">
                                <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-ink/25 dark:stroke-white/25" strokeWidth={1} />
                                {prev && hv?.prev !== undefined && (
                                    <circle cx={x(hover)} cy={yv(hv.prev)} r={4} strokeWidth={2} className="fill-gray-400 stroke-white dark:fill-gray-500 dark:stroke-gray-900" />
                                )}
                                {hv?.cur !== undefined && <circle cx={x(hover)} cy={yv(hv.cur)} r={4} fill="currentColor" strokeWidth={2} className="stroke-white dark:stroke-gray-900" />}
                            </g>
                        )}
                    </svg>
                )}

                {/* Tooltip: every series at that day; values lead, labels follow. */}
                {hover !== null && (
                    <div
                        className="glass glass-menu pointer-events-none absolute top-1 z-10 min-w-32 rounded-lg px-2.5 py-2"
                        style={tipFlip ? { right: width - tipLeft + 10 } : { left: tipLeft + 10 }}
                    >
                        <p className="text-eyebrow text-ink-soft dark:text-slate-400">{t('overview.paceDay', { d: hover + 1 })}</p>
                        <p className="mt-1.5 flex items-center gap-2 text-meta">
                            <span className="h-0.5 w-3 shrink-0 rounded-full bg-emerald-700 dark:bg-emerald-500" />
                            <span className="font-semibold tabular-nums text-ink dark:text-white">{hv?.cur !== undefined ? fmtHours(hv.cur) : '—'}</span>
                            <span className="capitalize text-ink-soft dark:text-slate-400">{thisName}</span>
                        </p>
                        {prev && (
                            <p className="mt-1 flex items-center gap-2 text-meta">
                                <span className="h-0.5 w-3 shrink-0 rounded-full bg-gray-400 dark:bg-gray-500" />
                                <span className="font-semibold tabular-nums text-ink dark:text-white">{hv?.prev !== undefined ? fmtHours(hv.prev) : '—'}</span>
                                <span className="capitalize text-ink-soft dark:text-slate-400">{prevName}</span>
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Table view for screen readers (the values must not live only in a tooltip). */}
            <table className="sr-only">
                <caption>{t('overview.pace')}</caption>
                <thead>
                    <tr>
                        <th>{t('overview.colDate')}</th>
                        <th>{thisName}</th>
                        {prev && <th>{prevName}</th>}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: days }, (_, i) => (
                        <tr key={i}>
                            <td>{i + 1}.</td>
                            <td>{cur[i] !== undefined ? fmtHours(cur[i]) : '—'}</td>
                            {prev && <td>{prev[i] !== undefined ? fmtHours(prev[i]) : '—'}</td>}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
