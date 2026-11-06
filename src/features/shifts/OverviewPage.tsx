import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarBlankIcon,
  MapPinIcon,
  TimerIcon,
  StackIcon,
  ChartBarIcon,
  DownloadSimpleIcon,
  FilePdfIcon,
  FileXlsIcon,
  FileCsvIcon,
  CoinsIcon,
  ArrowUpRightIcon,
  ArrowDownRightIcon,
} from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useShiftContext } from './ShiftContext';
import { useAuthContext } from '@features/auth/AuthContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { type Shift } from '@shared/types';
import { DataTable, type Column } from '@shared/components/DataTable';
import { MonthPicker } from '@shared/components/MonthPicker';
import { Skeleton } from '@shared/components/Skeleton';
import { shiftHours, fmtHours, fmtDuration, shiftGrossHours, shiftBreakHours, hoursByDay, monthHours, prevMonthKey } from './shiftStats';
import { scheduleService } from '@features/schedule/scheduleService';
import { MonthPlanCard } from './components/MonthPlanCard';
import { MonthPaceChart } from './components/MonthPaceChart';
import { formatClock, monthShort, monthKey, weekdayShort } from '@shared/utils/date';
import { type ExportFormat, makeExportLabels } from '@features/timesheets/exportShifts';
import { shareOrExport } from '@shared/utils/shareExport';
import { PageHeader } from '@shared/components/PageHeader';
import { Button } from '@shared/components/Button';
import { useWages } from '@features/wages/useWages';
import { estimatePay } from '@features/wages/types';

/**
 * --- CONSTANTS ---
 */

/**
 * --- HELPERS ---
 */
function fmtTimeRange(s: Shift): string {
  return `${formatClock(s.started_at)} – ${formatClock(s.ended_at)}`;
}

/**
 * --- OVERVIEW PAGE ---
 */
export default function OverviewPage() {
  const { userShifts, locations, isLoading } = useShiftContext();
  const { user } = useAuthContext();
  const t = useTranslation();

  const [selectedMonth, setSelectedMonth] = useState<string | null>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [exportOpen, setExportOpen] = useState(false);
  const { mine: myWage } = useWages(user);
  const myRate = myWage.data ?? null;

  // A running shift keeps counting: re-derive the stats once a minute while
  // one is open (otherwise the numbers froze at the moment the page loaded).
  const hasOpenShift = userShifts.some((s) => !s.ended_at);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hasOpenShift) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [hasOpenShift]);

  const locationName = useMemo(() => {
    const map = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string) => map.get(id) ?? t('common.unknown');
  }, [locations, t]);

  const stats = useMemo(() => {
    const filtered = selectedMonth
      ? userShifts.filter(s => monthKey(s.started_at) === selectedMonth)
      : userShifts;

    const shifts = [...filtered].sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    );

    let totalHours = 0;
    let totalGross = 0;
    let completedHours = 0;
    let completed = 0;
    const byLocation = new Map<string, number>();

    for (const s of shifts) {
      const h = shiftHours(s, now);
      totalHours += h;
      totalGross += shiftGrossHours(s, now);
      if (s.ended_at) {
        completed += 1;
        completedHours += h;
      }
      byLocation.set(s.location_id, (byLocation.get(s.location_id) ?? 0) + h);
    }

    const locationBreakdown = Array.from(byLocation.entries())
      .map(([id, hours]) => {
        const percent = totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0;
        const share = totalHours > 0 ? (hours / totalHours) * 100 : 0;
        return { id, hours, percent, share };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    // Average of FINISHED shifts — a shift still running isn't a whole shift yet.
    const avg = completed > 0 ? completedHours / completed : 0;

    return {
      shifts,
      totalHours,
      totalGross,
      totalBreak: totalGross - totalHours,
      avg,
      count: shifts.length,
      locationBreakdown,
      hasData: shifts.length > 0,
    };
  }, [userShifts, selectedMonth, now]);

  // --- Month-only insights: the rota plan, hours per day, vs last month ---
  const isCurrentMonth = selectedMonth === monthKey(new Date(now).toISOString());
  const monthBounds = useMemo(() => {
    if (!selectedMonth) return null;
    const [y, m] = selectedMonth.split('-').map(Number);
    return { start: new Date(y, m - 1, 1).toISOString(), end: new Date(y, m, 1).toISOString() };
  }, [selectedMonth]);
  // Same key + range as the Schedule page, so the two share one cached fetch.
  const rotaQ = useQuery({
    queryKey: ['schedule', selectedMonth],
    queryFn: () => scheduleService.getRange(monthBounds!.start, monthBounds!.end),
    enabled: !!user && !!monthBounds,
  });
  const myPlanned = useMemo(
    () => (rotaQ.data ?? []).filter((s) => s.user_id === user?.id && s.published),
    [rotaQ.data, user?.id],
  );
  const daily = useMemo(() => (selectedMonth ? hoursByDay(userShifts, selectedMonth, now) : null), [userShifts, selectedMonth, now]);
  // Last month's days, for the pace chart's reference line (null = nothing to compare).
  const prevDaily = useMemo(() => {
    if (!selectedMonth) return null;
    const prev = prevMonthKey(selectedMonth);
    return userShifts.some((s) => monthKey(s.started_at) === prev) ? hoursByDay(userShifts, prev, now) : null;
  }, [userShifts, selectedMonth, now]);
  const lastDayIndex = daily ? (isCurrentMonth ? new Date(now).getDate() - 1 : daily.length - 1) : 0;

  // Vs last month — for the month still running, against the same days of
  // last month (a half month vs a whole one would always look like a drop).
  const comparison = useMemo(() => {
    if (!selectedMonth) return null;
    const prev = prevMonthKey(selectedMonth);
    if (!userShifts.some((s) => monthKey(s.started_at) === prev)) return null;
    const upto = isCurrentMonth ? new Date(now).getDate() : undefined;
    return { delta: stats.totalHours - monthHours(userShifts, prev, now, upto), samePeriod: isCurrentMonth };
  }, [selectedMonth, userShifts, now, isCurrentMonth, stats.totalHours]);

  // Shift history rendered through the shared DataTable so it matches the admin
  // tables exactly (one compact monolithic table on every breakpoint).
  const historyColumns: Column<Shift>[] = [
    {
      key: 'date',
      header: t('overview.colDate'),
      width: 'w-16 sm:w-24',
      className: 'whitespace-nowrap',
      footer: <span className="text-label text-gray-400">{t('overview.total')}</span>,
      render: (shift) => {
        const date = new Date(shift.started_at);
        return (
          <div className="flex flex-col">
            <span className="text-small-strong dark:text-white">
              {date.getDate()} {monthShort(date)}
            </span>
            <span className="text-micro text-gray-400">{weekdayShort(date)}</span>
          </div>
        );
      },
    },
    {
      key: 'location',
      header: t('overview.colLocationTime'),
      className: 'w-full',
      // On mobile the Gross/Break columns are hidden to fit; surface them here.
      footer: (
        <span className="sm:hidden text-caption text-gray-500 dark:text-gray-400 tabular-nums">
          {fmtDuration(stats.totalGross)} · −{fmtDuration(stats.totalBreak)}
        </span>
      ),
      render: (shift) => {
        const gross = shiftGrossHours(shift, now);
        const brk = shiftBreakHours(shift, now);
        return (
          <div className="flex flex-col min-w-0">
            <span className="text-small-strong text-gray-700 dark:text-gray-200 truncate">{locationName(shift.location_id)}</span>
            <span className="text-caption text-gray-400 tabular-nums">{fmtTimeRange(shift)}</span>
            <span className="sm:hidden text-caption text-gray-400 tabular-nums">
              {t('overview.colGross')} {fmtDuration(gross)}{brk > 0 ? ` · −${fmtDuration(brk)}` : ''}
            </span>
          </div>
        );
      },
    },
    {
      key: 'gross',
      header: t('overview.colGross'),
      align: 'right',
      width: 'w-24',
      hideOnMobile: true,
      className: 'text-xs font-bold tabular-nums whitespace-nowrap text-gray-600 dark:text-gray-300',
      footer: <span className="text-xs font-bold tabular-nums whitespace-nowrap dark:text-white">{fmtDuration(stats.totalGross)}</span>,
      render: (shift) => fmtDuration(shiftGrossHours(shift, now)),
    },
    {
      key: 'break',
      header: t('overview.colBreak'),
      align: 'right',
      width: 'w-20',
      hideOnMobile: true,
      className: 'text-xs font-bold tabular-nums whitespace-nowrap text-amber-600 dark:text-amber-400',
      footer: <span className="text-xs font-bold tabular-nums whitespace-nowrap text-amber-600 dark:text-amber-400">−{fmtDuration(stats.totalBreak)}</span>,
      render: (shift) => {
        const brk = shiftBreakHours(shift, now);
        return brk > 0 ? `−${fmtDuration(brk)}` : '—';
      },
    },
    {
      key: 'net',
      header: t('overview.colNet'),
      align: 'right',
      width: 'w-20 sm:w-24',
      footer: <span className="text-xs font-bold tabular-nums whitespace-nowrap text-emerald-700 dark:text-emerald-300">{fmtDuration(stats.totalHours)}</span>,
      render: (shift) => {
        const ongoing = !shift.ended_at;
        return (
          <>
            <span className={`block text-xs font-bold tabular-nums whitespace-nowrap ${ongoing ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-300'}`}>
              {fmtDuration(shiftHours(shift, now))}
            </span>
            {ongoing && <span className="block text-micro text-amber-600 dark:text-amber-400">{t('overview.live')}</span>}
          </>
        );
      },
    },
  ];

  // Export uses the same builder as Timesheets, so the employee's own report is
  // byte-for-byte identical in layout (header, totals, break legend, table,
  // signature block) — just sourced from their own shifts.
  const employeeName =
    (user && [user.first_name, user.last_name].filter(Boolean).join(' ')) || user?.username || 'Me';
  const periodLabel = selectedMonth ?? t('overview.allTime');

  const doExport = (fmt: ExportFormat) => {
    void shareOrExport({
      employeeName,
      periodLabel,
      shifts: stats.shifts,
      locationName,
      labels: makeExportLabels(t),
    }, fmt);
    setExportOpen(false);
  };

  const deltaLine: ReactNode = comparison && (() => {
    const d = Math.round(comparison.delta * 10) / 10;
    const tone = d > 0 ? 'text-emerald-700 dark:text-emerald-300' : d < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-ink-soft dark:text-slate-400';
    const Arrow = d > 0 ? ArrowUpRightIcon : ArrowDownRightIcon;
    const signed = `${d > 0 ? '+' : '−'}${fmtHours(Math.abs(d))}`;
    const full = d === 0 ? t('overview.vsPrevSame') : t('overview.vsPrev', { delta: signed });
    return (
      <span
        className={`mt-1 flex items-center gap-0.5 truncate text-caption font-semibold ${tone}`}
        title={[full, comparison.samePeriod && t('overview.vsPrevSameDays')].filter(Boolean).join(' — ')}
      >
        {d !== 0 && <Arrow weight="bold" className="size-3 shrink-0" />}
        {/* Phones: just the number (the card is narrow); full sentence from sm. */}
        <span className="truncate sm:hidden">{d === 0 ? '±0h' : signed}</span>
        <span className="hidden truncate sm:inline">{full}</span>
      </span>
    );
  })();

  const statCards: { label: string; value: string; icon: typeof TimerIcon; sub?: ReactNode }[] = [
    { label: t('overview.workTime'), value: fmtHours(stats.totalHours), icon: TimerIcon, sub: deltaLine },
    { label: t('overview.shifts'), value: String(stats.count), icon: StackIcon },
    { label: t('overview.avgShift'), value: fmtHours(stats.avg), icon: ChartBarIcon },
  ];
  // Pay estimate — only when an admin has set the member's hourly rate.
  if (myRate) {
    const pay = estimatePay(stats.totalHours, myRate.hourly_rate);
    statCards.push({
      label: t('wage.estPay'),
      value: new Intl.NumberFormat(undefined, { style: 'currency', currency: myRate.currency, maximumFractionDigits: 0 }).format(pay),
      icon: CoinsIcon,
    });
  }

  // Share of time per location — only worth a card when there's more than one.
  const locationCard = (
    <div className="glass p-4 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-label text-ink-soft dark:text-slate-400 flex items-center gap-1.5">
          <MapPinIcon weight="bold" className="size-3.5 text-emerald-600 dark:text-emerald-300" /> {t('overview.byLocation')}
        </h2>
        <span className="text-micro text-ink-soft dark:text-slate-400">{t('overview.shareOfTime')}</span>
      </div>
      <div className="space-y-3.5">
        {stats.locationBreakdown.map((l) => (
          <div key={l.id}>
            <div className="flex items-end justify-between mb-1.5">
              <div className="flex min-w-0 flex-col">
                <span className="text-small-strong text-ink dark:text-slate-200 truncate">{locationName(l.id)}</span>
                <span className="text-caption text-ink-soft dark:text-slate-400 tabular-nums">{t('overview.worked', { hours: fmtHours(l.hours) })}</span>
              </div>
              <span className="text-metric-sm text-emerald-700 dark:text-emerald-300">{l.percent}%</span>
            </div>
            <div className="h-2 rounded-full bg-ink/6 dark:bg-white/8 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${l.share}%` }}
                className="h-full bg-linear-to-r from-emerald-500 to-emerald-400 rounded-full"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 px-1 pb-10">
      <PageHeader
        eyebrow={selectedMonth ? t('overview.titleMonthly') : t('overview.titleAll')}
        title={t('nav.overview')}
        actions={
          <>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setExportOpen((v) => !v)}
                  disabled={!stats.hasData}
                  className="glass flex items-center justify-center w-9 h-9 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 active:scale-90 transition-all disabled:opacity-40"
                  title={t('overview.export')}
                >
                  <DownloadSimpleIcon weight="bold" className="w-4 h-4" />
                </button>
                <AnimatePresence>
                  {exportOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 4, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        className="glass glass-menu absolute right-0 top-full z-50 w-44 rounded-2xl p-1.5 overflow-hidden"
                      >
                        {([
                          { fmt: 'pdf' as const, label: 'PDF', Icon: FilePdfIcon },
                          { fmt: 'excel' as const, label: 'Excel', Icon: FileXlsIcon },
                          { fmt: 'csv' as const, label: 'CSV', Icon: FileCsvIcon },
                        ]).map(({ fmt, label, Icon }) => (
                          <button
                            key={fmt}
                            onClick={() => doExport(fmt)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-small text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-white/5 transition-colors"
                          >
                            <Icon weight="bold" className="w-4 h-4 text-emerald-500" />
                            {label}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
              <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
            </div>
          </>
        }
      />

      {isLoading && !stats.hasData ? (
        <div className="space-y-3" aria-hidden>
          {/* stat cards */}
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass p-3 rounded-2xl">
                <Skeleton className="h-3 w-2/3 mb-2" />
                <Skeleton className="h-6 w-1/2" />
              </div>
            ))}
          </div>
          {/* chart cards */}
          <div className="grid sm:grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="glass p-4 rounded-2xl space-y-4">
                <Skeleton className="h-3.5 w-24" />
                {[0, 1, 2].map((j) => (
                  <Skeleton key={j} className="h-8 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : !stats.hasData ? (
        <div className="glass flex flex-col items-center rounded-2xl px-6 py-8 text-center">
          <div className="mb-2.5 flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <CalendarBlankIcon weight="duotone" className="size-6" />
          </div>
          <p className="text-body-strong text-ink dark:text-white">{t('overview.noData')}</p>
          <p className="mt-1 max-w-xs text-caption text-ink-soft dark:text-slate-400">{t('overview.noDataHint')}</p>
          {/* A filtered month with nothing in it — offer the one-tap way out. */}
          {selectedMonth && userShifts.length > 0 && (
            <Button size="sm" variant="tonal" className="mt-3" onClick={() => setSelectedMonth(null)}>
              {t('overview.showAllTime')}
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* TOP STATS */}
          <div className={`grid gap-2 ${statCards.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
            {statCards.map((stat) => (
              <div key={stat.label} className="glass min-w-0 rounded-2xl p-3">
                <p className="flex items-center gap-1 truncate text-eyebrow text-ink-soft dark:text-slate-400">
                  <stat.icon weight="bold" className="hidden size-3.5 shrink-0 text-emerald-600 sm:block dark:text-emerald-300" />
                  <span className="truncate">{stat.label}</span>
                </p>
                <p className="mt-1.5 truncate text-metric text-emerald-700 dark:text-emerald-300">{stat.value}</p>
                {stat.sub}
              </div>
            ))}
          </div>

          {/* MONTH INSIGHTS — the rota plan (+ locations when there's more than one), then hours by day. */}
          {selectedMonth && (
            <div className={`grid gap-3 ${stats.locationBreakdown.length > 1 ? 'sm:grid-cols-2' : ''}`}>
              <MonthPlanCard planned={myPlanned} worked={stats.count} now={now} />
              {stats.locationBreakdown.length > 1 && locationCard}
            </div>
          )}
          {!selectedMonth && stats.locationBreakdown.length > 1 && locationCard}
          {selectedMonth && daily && <MonthPaceChart monthKey={selectedMonth} daily={daily} prevDaily={prevDaily} lastDayIndex={lastDayIndex} />}

          {/* HISTORY */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1 px-1">
              <h2 className="text-heading dark:text-white">
                {selectedMonth ? t('overview.historyMonthly') : t('overview.historyAll')}
              </h2>
              <span className="rounded-full bg-ink/5 px-2 py-0.5 text-micro text-ink-soft dark:bg-white/8 dark:text-slate-400">
                {t('overview.entries', { count: stats.shifts.length })}
              </span>
            </div>
            <p className="px-1 mb-3 text-caption leading-relaxed text-ink-soft dark:text-slate-400">
              {t('overview.netExplain')} {t('overview.netRule')}
            </p>

            <DataTable rows={stats.shifts} rowKey={(s) => s.id} columns={historyColumns} />
          </div>
        </>
      )}
    </div>
  );
}
