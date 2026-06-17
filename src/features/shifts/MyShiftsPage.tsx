import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ClockIcon,
  CalendarBlankIcon,
  MapPinIcon,
  TimerIcon,
  StackIcon,
  ChartBarIcon,
} from '@phosphor-icons/react';
import { useShiftContext } from './ShiftContext';
import { type Shift } from '@shared/types';

/**
 * --- MY SHIFTS PAGE ---
 * Real shift history + statistics for the signed-in user, computed from the
 * shifts already loaded into ShiftContext (userShifts + locations). Charts are
 * lightweight SVG/CSS — no chart dependency.
 */

const MS_PER_HOUR = 1000 * 60 * 60;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Hours a shift lasted (open shifts count up to "now"). */
function shiftHours(s: Shift): number {
  const start = new Date(s.started_at).getTime();
  const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
  return Math.max(0, (end - start) / MS_PER_HOUR);
}

function fmtHours(h: number): string {
  return `${Math.round(h * 10) / 10}h`;
}

function fmtDuration(h: number): string {
  const totalMin = Math.round(h * 60);
  const hrs = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return hrs > 0 ? `${hrs}h ${min}m` : `${min}m`;
}

function fmtDayLabel(d: Date): string {
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function fmtTimeRange(s: Shift): string {
  const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const start = new Date(s.started_at).toLocaleTimeString(undefined, opts);
  const end = s.ended_at ? new Date(s.ended_at).toLocaleTimeString(undefined, opts) : '…';
  return `${start} – ${end}`;
}

export default function MyShiftsPage() {
  const { userShifts, locations, isLoading } = useShiftContext();

  const locationName = useMemo(() => {
    const map = new Map(locations.map((l) => [l.id, l.name]));
    return (id: string) => map.get(id) ?? 'Unknown location';
  }, [locations]);

  const stats = useMemo(() => {
    // De-dupe (realtime can append) and sort newest first.
    const shifts = Array.from(new Map(userShifts.map((s) => [s.id, s])).values()).sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    );

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let monthHours = 0;
    let monthCount = 0;
    let totalHours = 0;

    // Last 14 days buckets (oldest -> newest).
    const days: { date: Date; hours: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({ date: d, hours: 0 });
    }
    const dayIndex = new Map(days.map((d, i) => [d.date.toDateString(), i]));

    const byLocation = new Map<string, number>();
    const byWeekday = new Array(7).fill(0) as number[];

    for (const s of shifts) {
      const h = shiftHours(s);
      totalHours += h;
      const started = new Date(s.started_at);
      if (started.getTime() >= monthStart) {
        monthHours += h;
        monthCount += 1;
      }
      const di = dayIndex.get(started.toDateString());
      if (di !== undefined) days[di].hours += h;
      byLocation.set(s.location_id, (byLocation.get(s.location_id) ?? 0) + h);
      // JS getDay(): 0=Sun..6=Sat -> shift to Mon..Sun.
      byWeekday[(started.getDay() + 6) % 7] += h;
    }

    const locationBreakdown = Array.from(byLocation.entries())
      .map(([id, hours]) => ({ id, hours }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    const completed = shifts.filter((s) => s.ended_at).length;
    const avg = completed > 0 ? totalHours / shifts.length : 0;

    return {
      shifts,
      monthHours,
      monthCount,
      totalHours,
      avg,
      days,
      locationBreakdown,
      byWeekday,
      hasData: shifts.length > 0,
    };
  }, [userShifts]);

  const maxDay = Math.max(...stats.days.map((d) => d.hours), 0.01);
  const maxLoc = Math.max(...stats.locationBreakdown.map((l) => l.hours), 0.01);
  const maxWeekday = Math.max(...stats.byWeekday, 0.01);

  const statCards = [
    { label: 'This month', value: fmtHours(stats.monthHours), icon: ClockIcon },
    { label: 'Shifts (month)', value: String(stats.monthCount), icon: StackIcon },
    { label: 'Avg. shift', value: fmtHours(stats.avg), icon: TimerIcon },
    { label: 'Total logged', value: fmtHours(stats.totalHours), icon: ChartBarIcon },
  ];

  return (
    <div className="space-y-4 px-1 pb-10">
      {/* HEADER */}
      <header className="space-y-0.5">
        <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest">Work history</p>
        <h1 className="text-gray-900 dark:text-white font-black text-2xl tracking-tight">My Shifts</h1>
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
            <h2 className="font-black text-gray-900 dark:text-white">No shifts yet</h2>
            <p className="text-sm text-gray-400 mt-1">Once you start checking in, your history and stats will appear here.</p>
          </div>
        </div>
      ) : (
        <>
          {/* STATS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {statCards.map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-gray-800/40 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="flex items-center gap-1.5 mb-2 text-gray-400">
                  <stat.icon weight="bold" className="w-3.5 h-3.5" />
                  <p className="text-[10px] font-black uppercase tracking-widest">{stat.label}</p>
                </div>
                <p className="text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* DAILY ACTIVITY (last 14 days) */}
          <div className="bg-white dark:bg-gray-800/40 p-4 sm:p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-gray-900 dark:text-white">Daily activity</h2>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Last 14 days</span>
            </div>
            <div className="flex items-end justify-between gap-1 sm:gap-1.5 h-36">
              {stats.days.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full group">
                  <div className="w-full flex items-end justify-center h-full">
                    <div
                      title={`${fmtDayLabel(d.date)}: ${fmtDuration(d.hours)}`}
                      className={`w-full max-w-[26px] rounded-md transition-colors ${
                        d.hours > 0 ? 'bg-emerald-500 group-hover:bg-emerald-400' : 'bg-gray-100 dark:bg-gray-700/40'
                      }`}
                      style={{ height: `${Math.max((d.hours / maxDay) * 100, d.hours > 0 ? 6 : 2)}%` }}
                    />
                  </div>
                  <span className="text-[8px] font-bold text-gray-400 tabular-nums">{d.date.getDate()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* BREAKDOWNS */}
          <div className="grid lg:grid-cols-2 gap-3">
            {/* By location */}
            <div className="bg-white dark:bg-gray-800/40 p-4 sm:p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
              <h2 className="text-sm font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <MapPinIcon weight="bold" className="w-4 h-4 text-emerald-500" /> Hours by location
              </h2>
              <div className="space-y-3">
                {stats.locationBreakdown.map((l) => (
                  <div key={l.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate pr-2">{locationName(l.id)}</span>
                      <span className="text-xs font-black text-gray-900 dark:text-white tabular-nums shrink-0">{fmtHours(l.hours)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700/40 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(l.hours / maxLoc) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By weekday */}
            <div className="bg-white dark:bg-gray-800/40 p-4 sm:p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
              <h2 className="text-sm font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <ChartBarIcon weight="bold" className="w-4 h-4 text-emerald-500" /> Busiest weekdays
              </h2>
              <div className="flex items-end justify-between gap-2 h-28">
                {stats.byWeekday.map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                    <div className="w-full flex items-end justify-center h-full">
                      <div
                        title={`${WEEKDAYS[i]}: ${fmtDuration(h)}`}
                        className={`w-full max-w-[24px] rounded-md ${h > 0 ? 'bg-emerald-500/80' : 'bg-gray-100 dark:bg-gray-700/40'}`}
                        style={{ height: `${Math.max((h / maxWeekday) * 100, h > 0 ? 6 : 2)}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-bold text-gray-400 uppercase">{WEEKDAYS[i][0]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* HISTORY */}
          <div className="space-y-2 mt-2">
            <h2 className="text-base font-black dark:text-white px-1">History</h2>
            <div className="grid gap-2">
              {stats.shifts.map((shift, idx) => {
                const ongoing = !shift.ended_at;
                const hours = shiftHours(shift);
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                    key={shift.id}
                    className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                      <MapPinIcon weight="bold" className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm dark:text-white truncate">{locationName(shift.location_id)}</h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight truncate">
                        {fmtDayLabel(new Date(shift.started_at))} • {fmtTimeRange(shift)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 pr-1 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs font-black text-gray-900 dark:text-white tabular-nums">{fmtDuration(hours)}</p>
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Work time</p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest ${
                          ongoing
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {ongoing ? 'In progress' : 'Completed'}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
