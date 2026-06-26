import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarBlankIcon,
  MapPinIcon,
  TimerIcon,
  StackIcon,
  ChartBarIcon,
  TrendUpIcon,
  DownloadSimpleIcon,
  FilePdfIcon,
  FileXlsIcon,
  FileCsvIcon,
} from '@phosphor-icons/react';
import { useShiftContext } from './ShiftContext';
import { useAuthContext } from '@features/auth/AuthContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { type Shift } from '@shared/types';
import { DataTable, type Column } from '@shared/components/DataTable';
import { MonthPicker } from '@shared/components/MonthPicker';
import { shiftHours, fmtHours, fmtDuration, shiftGrossHours, shiftBreakHours } from './shiftStats';
import { exportShifts, type ExportFormat } from '@features/timesheets/exportShifts';

/**
 * --- CONSTANTS ---
 */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * --- HELPERS ---
 */
function fmtTimeRange(s: Shift): string {
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const start = new Date(s.started_at).toLocaleTimeString(undefined, opts);
  const end = s.ended_at ? new Date(s.ended_at).toLocaleTimeString(undefined, opts) : '…';
  return `${start} – ${end}`;
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

  const locationName = useMemo(() => {
    const map = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string) => map.get(id) ?? t('common.unknown');
  }, [locations, t]);

  const stats = useMemo(() => {
    const filtered = selectedMonth
      ? userShifts.filter(s => s.started_at.startsWith(selectedMonth))
      : userShifts;

    const shifts = [...filtered].sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    );

    let totalHours = 0;
    let totalGross = 0;
    const byLocation = new Map<string, number>();
    const byWeekday = new Array(7).fill(0) as number[];

    for (const s of shifts) {
      const h = shiftHours(s);
      totalHours += h;
      totalGross += shiftGrossHours(s);
      const started = new Date(s.started_at);
      byLocation.set(s.location_id, (byLocation.get(s.location_id) ?? 0) + h);
      byWeekday[(started.getDay() + 6) % 7] += h;
    }

    const locationBreakdown = Array.from(byLocation.entries())
      .map(([id, hours]) => {
        const percent = totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0;
        const share = totalHours > 0 ? (hours / totalHours) * 100 : 0;
        return { id, hours, percent, share };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    const completed = shifts.filter((s) => s.ended_at).length;
    const avg = completed > 0 ? totalHours / shifts.length : 0;

    return {
      shifts,
      totalHours,
      totalGross,
      totalBreak: totalGross - totalHours,
      avg,
      count: shifts.length,
      locationBreakdown,
      byWeekday,
      hasData: shifts.length > 0,
    };
  }, [userShifts, selectedMonth]);

  const maxWeekday = Math.max(...stats.byWeekday, 0.1);

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
              {date.getDate()} {date.toLocaleDateString(undefined, { month: 'short' })}
            </span>
            <span className="text-micro text-gray-400">{WEEKDAYS[(date.getDay() + 6) % 7]}</span>
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
          {fmtHours(stats.totalGross)} · −{fmtHours(stats.totalBreak)}
        </span>
      ),
      render: (shift) => {
        const gross = shiftGrossHours(shift);
        const brk = shiftBreakHours(shift);
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
      width: 'w-20',
      hideOnMobile: true,
      className: 'text-xs font-bold tabular-nums text-gray-600 dark:text-gray-300',
      footer: <span className="text-xs font-black tabular-nums dark:text-white">{fmtHours(stats.totalGross)}</span>,
      render: (shift) => fmtDuration(shiftGrossHours(shift)),
    },
    {
      key: 'break',
      header: t('overview.colBreak'),
      align: 'right',
      width: 'w-20',
      hideOnMobile: true,
      className: 'text-xs font-bold tabular-nums text-amber-500',
      footer: <span className="text-xs font-black tabular-nums text-amber-500">-{fmtHours(stats.totalBreak)}</span>,
      render: (shift) => {
        const brk = shiftBreakHours(shift);
        return brk > 0 ? `-${fmtDuration(brk)}` : '—';
      },
    },
    {
      key: 'net',
      header: t('overview.colNet'),
      align: 'right',
      width: 'w-20 sm:w-24',
      footer: <span className="text-xs font-black tabular-nums whitespace-nowrap text-emerald-600 dark:text-emerald-400">{fmtHours(stats.totalHours)}</span>,
      render: (shift) => {
        const ongoing = !shift.ended_at;
        return (
          <>
            <span className={`block text-xs font-black tabular-nums whitespace-nowrap ${ongoing ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {fmtDuration(shiftHours(shift))}
            </span>
            {ongoing && <span className="block text-micro text-amber-500">{t('overview.live')}</span>}
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
    void exportShifts(fmt, {
      employeeName,
      periodLabel,
      shifts: stats.shifts,
      locationName,
    });
    setExportOpen(false);
  };

  const statCards = [
    { label: t('overview.workTime'), value: fmtHours(stats.totalHours), icon: TimerIcon },
    { label: t('overview.shifts'), value: String(stats.count), icon: StackIcon },
    { label: t('overview.avgShift'), value: fmtHours(stats.avg), icon: ChartBarIcon },
  ];

  return (
    <div className="space-y-4 px-1 pb-10">
      <header className="flex items-end justify-between gap-3 pt-2">
        <div className="space-y-0.5">
          <p className="text-label text-emerald-500 text-left">
            {selectedMonth ? t('overview.titleMonthly') : t('overview.titleAll')}
          </p>
          <h1 className="text-display text-gray-900 dark:text-white">Overview</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setExportOpen((v) => !v)}
              disabled={!stats.hasData}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-500/10 active:scale-90 transition-all disabled:opacity-40"
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
                    className="absolute right-0 top-full z-50 w-44 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl p-1.5 overflow-hidden"
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
      </header>

      {isLoading && !stats.hasData ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !stats.hasData ? (
        <div className="flex flex-col items-center justify-center text-center py-20 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500">
            <CalendarBlankIcon weight="bold" className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-heading text-gray-900 dark:text-white">No data found</h2>
            <p className="text-body text-gray-400 mt-1">Try selecting a different month or clear the filter.</p>
          </div>
        </div>
      ) : (
        <>
          {/* TOP STATS */}
          <div className="grid grid-cols-3 gap-2">
            {statCards.map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-gray-800/40 p-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden group">
                <div className="relative z-10">
                  <p className="text-micro text-gray-400 mb-1 truncate">{stat.label}</p>
                  <p className="text-metric text-emerald-600 dark:text-emerald-400">{stat.value}</p>
                </div>
                <stat.icon className="absolute -right-1 -bottom-1 w-12 h-12 text-emerald-500/5 group-hover:text-emerald-500/10 transition-colors" weight="bold" />
              </div>
            ))}
          </div>

          {/* CHARTS SECTION */}
          <div className="grid sm:grid-cols-2 gap-3 items-start">
            {/* BY LOCATION */}
            <div className="bg-white dark:bg-gray-800/40 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-label text-gray-400 flex items-center gap-1.5">
                  <MapPinIcon weight="bold" className="w-4 h-4 text-emerald-500" /> Locations
                </h2>
                <span className="text-micro text-gray-400">Share of time</span>
              </div>
              <div className="space-y-4">
                {stats.locationBreakdown.map((l) => (
                  <div key={l.id} className="group">
                    <div className="flex items-end justify-between mb-1.5">
                      <div className="flex flex-col">
                        <span className="text-small-strong text-gray-800 dark:text-gray-200 truncate">{locationName(l.id)}</span>
                        <span className="text-caption text-gray-400 tabular-nums">{fmtHours(l.hours)} worked</span>
                      </div>
                      <span className="text-metric-sm text-emerald-600 dark:text-emerald-400">{l.percent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800/60 overflow-hidden">
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

            {/* BY WEEKDAY */}
            <div className="bg-white dark:bg-gray-800/40 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-label text-gray-400 flex items-center gap-1.5">
                  <ChartBarIcon weight="bold" className="w-4 h-4 text-emerald-500" /> Busiest Days
                </h2>
                <TrendUpIcon className="w-4 h-4 text-gray-300" />
              </div>
              {/* Value labels */}
              <div className="flex justify-between gap-2 h-6 mb-1">
                {stats.byWeekday.map((h, i) => {
                  const isMax = h === maxWeekday && h > 0;
                  return (
                    <div key={i} className="flex-1 text-center">
                      {h > 0 && (
                        <span className={`text-micro tabular-nums ${isMax ? 'text-emerald-500' : 'text-gray-400'}`}>
                          {Math.round(h)}H
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bars - fixed height area, grow from bottom */}
              <div className="flex items-end justify-between gap-2 h-28">
                {stats.byWeekday.map((h, i) => {
                  const isMax = h === maxWeekday && h > 0;
                  const pct = (h / maxWeekday) * 100;
                  return (
                    <div key={i} className="flex-1 flex justify-center h-full items-end">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${pct}%` }}
                        className={`w-full max-w-[16px] rounded-t-md transition-all ${
                          isMax
                            ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                            : h > 0 ? 'bg-gray-200 dark:bg-gray-700 group-hover:bg-emerald-500/40' : 'bg-gray-50 dark:bg-gray-800/40'
                        }`}
                        style={{ minHeight: h > 0 ? '4px' : '2px' }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Day labels */}
              <div className="flex justify-between gap-2 mt-1">
                {stats.byWeekday.map((h, i) => {
                  const isMax = h === maxWeekday && h > 0;
                  return (
                    <div key={i} className="flex-1 text-center">
                      <span className={`text-micro ${isMax ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {WEEKDAYS[i].slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* HISTORY */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1 px-1">
              <h2 className="text-heading dark:text-white">
                {selectedMonth ? t('overview.historyMonthly') : t('overview.historyAll')}
              </h2>
              <span className="text-micro text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg">
                {stats.shifts.length} entries
              </span>
            </div>
            <p className="px-1 mb-3 text-caption leading-relaxed text-gray-400">
              {t('overview.netExplain')}{' '}
              <span className="whitespace-nowrap">−30&nbsp;min from 6&nbsp;h</span>,{' '}
              <span className="whitespace-nowrap">−1&nbsp;h from 12&nbsp;h</span>.
            </p>

            <DataTable rows={stats.shifts} rowKey={(s) => s.id} columns={historyColumns} />
          </div>
        </>
      )}
    </div>
  );
}
