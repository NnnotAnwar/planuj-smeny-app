import { useMemo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarBlankIcon,
  MapPinIcon,
  TimerIcon,
  StackIcon,
  ChartBarIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  TrendUpIcon,
  DownloadSimpleIcon,
} from '@phosphor-icons/react';
import { useShiftContext } from './ShiftContext';
import { type Shift } from '@shared/types';
import { shiftHours, fmtHours, fmtDuration, shiftGrossHours, shiftBreakHours } from './shiftStats';

// PDF Libraries
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * --- CONSTANTS ---
 */
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

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
 * --- CUSTOM MONTH PICKER COMPONENT ---
 */
interface MonthPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

function MonthPicker({ value, onChange }: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const [viewYear, setViewYear] = useState(() =>
    value ? parseInt(value.split('-')[0]) : today.getFullYear()
  );

  const selectedYear = value ? parseInt(value.split('-')[0]) : null;
  const selectedMonthIdx = value ? parseInt(value.split('-')[1]) - 1 : null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMonthClick = (idx: number) => {
    const monthStr = String(idx + 1).padStart(2, '0');
    onChange(`${viewYear}-${monthStr}`);
    setIsOpen(false);
  };

  const label = value
    ? `${MONTHS[selectedMonthIdx!]} ${selectedYear}`
    : 'All Time';

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm active:scale-95 transition-all"
      >
        <CalendarBlankIcon weight="bold" className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-xs font-black dark:text-white min-w-[70px] text-left truncate">{label}</span>
        <CaretDownIcon
          weight="bold"
          className={`w-2.5 h-2.5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="absolute right-0 top-full z-50 w-52 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl p-3 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <button onClick={() => setViewYear(v => v - 1)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <CaretLeftIcon weight="bold" className="w-3 h-3 dark:text-white" />
              </button>
              <span className="font-black text-sm dark:text-white">{viewYear}</span>
              <button onClick={() => setViewYear(v => v + 1)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <CaretRightIcon weight="bold" className="w-3 h-3 dark:text-white" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((month, idx) => {
                const isSelected = selectedYear === viewYear && selectedMonthIdx === idx;
                const isCurrent = today.getFullYear() === viewYear && today.getMonth() === idx;
                return (
                  <button
                    key={month}
                    onClick={() => handleMonthClick(idx)}
                    className={`relative py-1.5 rounded-lg text-caption transition-all ${
                      isSelected ? 'bg-emerald-500 text-white shadow-md' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                    } ${isCurrent && !isSelected ? 'ring-1 ring-inset ring-emerald-500/30 text-emerald-600 dark:text-emerald-400' : ''}`}
                  >
                    {month}
                    {isCurrent && <span className={`absolute top-0.5 right-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 pt-2 border-t border-gray-50 dark:border-gray-800 flex gap-1.5">
              <button onClick={() => { setViewYear(today.getFullYear()); onChange(currentMonthStr); setIsOpen(false); }} className="flex-1 py-1.5 rounded-lg text-micro bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors">Today</button>
              <button onClick={() => { onChange(null); setIsOpen(false); }} className={`flex-1 py-1.5 rounded-lg text-micro transition-colors ${value === null ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>All</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * --- OVERVIEW PAGE ---
 */
export default function OverviewPage() {
  const { userShifts, locations, isLoading } = useShiftContext();

  const [selectedMonth, setSelectedMonth] = useState<string | null>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const locationName = useMemo(() => {
    const map = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string) => map.get(id) ?? 'Unknown';
  }, [locations]);

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
      .map(([id, hours]) => ({ id, hours, percent: totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0 }))
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

  const exportToPDF = () => {
    const doc = new jsPDF();
    const title = selectedMonth ? `Shifts Report - ${selectedMonth}` : 'Complete Shifts Report';

    // Header
    doc.setFontSize(20);
    doc.text('Planuj Smeny', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(title, 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 36);

    // Summary
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text(`Total Shifts: ${stats.count}`, 14, 48);
    doc.text(
      `Gross: ${fmtHours(stats.totalGross)}    Break: ${fmtHours(stats.totalBreak)}    Net: ${fmtHours(stats.totalHours)}`,
      14,
      54,
    );
    // Legend: how mandatory breaks are deducted.
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text('Mandatory breaks deducted: -30 min from 6h, -1h from 12h (per shift).', 14, 60);

    // Table
    const tableData = stats.shifts.map(s => {
      const d = new Date(s.started_at);
      const gross = shiftGrossHours(s);
      const net = shiftHours(s);
      const breakTime = shiftBreakHours(s);

      return [
        `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        WEEKDAYS[(d.getDay() + 6) % 7],
        locationName(s.location_id),
        fmtTimeRange(s),
        fmtDuration(gross),
        breakTime > 0 ? fmtDuration(breakTime) : '-',
        fmtDuration(net)
      ];
    });

    autoTable(doc, {
      startY: 66,
      head: [['Date', 'Day', 'Location', 'Time', 'Gross', 'Break', 'Net']],
      body: tableData,
      foot: [['', '', '', 'Total', fmtHours(stats.totalGross), fmtHours(stats.totalBreak), fmtHours(stats.totalHours)]],
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
      footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
      styles: { fontSize: 8 },
    });

    doc.save(`Shifts_${selectedMonth || 'AllTime'}.pdf`);
  };

  const statCards = [
    { label: 'Work Time', value: fmtHours(stats.totalHours), icon: TimerIcon },
    { label: 'Shifts', value: String(stats.count), icon: StackIcon },
    { label: 'Avg. Shift', value: fmtHours(stats.avg), icon: ChartBarIcon },
  ];

  return (
    <div className="space-y-4 px-1 pb-10">
      <header className="flex items-end justify-between gap-3 pt-2">
        <div className="space-y-0.5">
          <p className="text-label text-emerald-500 text-left">
            {selectedMonth ? 'Monthly Analytics' : 'All Time Analytics'}
          </p>
          <h1 className="text-display text-gray-900 dark:text-white">Overview</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToPDF}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-500/10 active:scale-90 transition-all"
            title="Export to PDF"
          >
            <DownloadSimpleIcon weight="bold" className="w-4 h-4" />
          </button>
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
          <div className="grid sm:grid-cols-2 gap-3">
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
                        animate={{ width: `${l.percent}%` }}
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
              <div className="flex items-end justify-between gap-2 h-32 pt-6">
                {stats.byWeekday.map((h, i) => {
                  const isMax = h === maxWeekday && h > 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-2 h-full group">
                      <div className="relative w-full flex flex-col items-center justify-end h-full">
                        {h > 0 && (
                          <motion.span
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`absolute -top-6 text-micro tabular-nums ${isMax ? 'text-emerald-500' : 'text-gray-400'}`}
                          >
                            {Math.round(h)}h
                          </motion.span>
                        )}
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${(h / maxWeekday) * 100}%` }}
                          className={`w-full max-w-[16px] rounded-t-md transition-all ${
                            isMax
                              ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                              : h > 0 ? 'bg-gray-200 dark:bg-gray-700 group-hover:bg-emerald-500/40' : 'bg-gray-50 dark:bg-gray-800/40'
                          }`}
                          style={{ minHeight: h > 0 ? '4px' : '2px' }}
                        />
                      </div>
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
                {selectedMonth ? 'Monthly Activity' : 'History'}
              </h2>
              <span className="text-micro text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg">
                {stats.shifts.length} entries
              </span>
            </div>
            <p className="px-1 mb-3 text-caption text-gray-400">
              Net = Gross − mandatory breaks (−30 min from 6h, −1h from 12h per shift).
            </p>

            {/* DESKTOP TABLE */}
            <div className="hidden sm:block bg-white dark:bg-gray-900/40 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    <th className="px-4 py-3 text-label text-gray-400">Date</th>
                    <th className="px-4 py-3 text-label text-gray-400">Location &amp; Time</th>
                    <th className="px-4 py-3 text-label text-gray-400 text-right">Gross</th>
                    <th className="px-4 py-3 text-label text-gray-400 text-right">Break</th>
                    <th className="px-4 py-3 text-label text-gray-400 text-right">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {stats.shifts.map((shift) => {
                    const ongoing = !shift.ended_at;
                    const gross = shiftGrossHours(shift);
                    const brk = shiftBreakHours(shift);
                    const net = shiftHours(shift);
                    const date = new Date(shift.started_at);
                    return (
                      <tr key={shift.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/20 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-small-strong dark:text-white">
                              {date.getDate()} {date.toLocaleDateString(undefined, { month: 'short' })}
                            </span>
                            <span className="text-micro text-gray-400">
                              {WEEKDAYS[(date.getDay() + 6) % 7]}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-small-strong text-gray-700 dark:text-gray-200 truncate">{locationName(shift.location_id)}</span>
                            <span className="text-caption text-gray-400 tabular-nums">{fmtTimeRange(shift)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-gray-600 dark:text-gray-300">{fmtDuration(gross)}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-amber-500">{brk > 0 ? `-${fmtDuration(brk)}` : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-black tabular-nums ${ongoing ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmtDuration(net)}</span>
                          {ongoing && <span className="block text-micro text-amber-500">Live</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
                    <td className="px-4 py-3 text-label text-gray-400" colSpan={2}>Total</td>
                    <td className="px-4 py-3 text-right text-xs font-black tabular-nums dark:text-white">{fmtHours(stats.totalGross)}</td>
                    <td className="px-4 py-3 text-right text-xs font-black tabular-nums text-amber-500">-{fmtHours(stats.totalBreak)}</td>
                    <td className="px-4 py-3 text-right text-xs font-black tabular-nums text-emerald-600 dark:text-emerald-400">{fmtHours(stats.totalHours)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* MOBILE CARDS */}
            <div className="sm:hidden space-y-2">
              {stats.shifts.map((shift) => {
                const ongoing = !shift.ended_at;
                const gross = shiftGrossHours(shift);
                const brk = shiftBreakHours(shift);
                const net = shiftHours(shift);
                const date = new Date(shift.started_at);
                return (
                  <div key={shift.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex flex-col items-center justify-center w-11 shrink-0">
                      <span className="text-metric-sm dark:text-white leading-none">{date.getDate()}</span>
                      <span className="text-micro text-gray-400">{WEEKDAYS[(date.getDay() + 6) % 7]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-small-strong text-gray-800 dark:text-gray-100 truncate">{locationName(shift.location_id)}</p>
                      <p className="text-caption text-gray-400 tabular-nums">{fmtTimeRange(shift)}</p>
                      <p className="text-caption text-gray-400 tabular-nums mt-0.5">
                        Gross {fmtDuration(gross)}{brk > 0 ? ` · Break -${fmtDuration(brk)}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-metric-sm ${ongoing ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmtDuration(net)}</span>
                      <span className="block text-micro text-gray-400">{ongoing ? 'Live' : 'Net'}</span>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800">
                <span className="text-micro text-gray-400">Total</span>
                <span className="text-metric-sm">
                  <span className="text-gray-500 dark:text-gray-400">{fmtHours(stats.totalGross)}</span>
                  <span className="text-amber-500"> −{fmtHours(stats.totalBreak)}</span>
                  <span className="text-emerald-600 dark:text-emerald-400"> = {fmtHours(stats.totalHours)}</span>
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
