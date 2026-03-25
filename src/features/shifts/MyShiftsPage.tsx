import { motion } from 'framer-motion';
import { CalendarIcon, ClockIcon, FunnelIcon, DownloadSimpleIcon } from "@phosphor-icons/react";

/**
 * --- MY SHIFTS PAGE ---
 * Unified style with Overview and Admin pages.
 */

export default function MyShiftsPage() {
  const mockShifts = [
    { id: 1, date: 'Today', location: 'Main Office', duration: '8h 15m', time: '08:00 - 16:15', status: 'Completed' },
    { id: 2, date: 'Yesterday', location: 'Prague Store', duration: '6h 00m', time: '10:00 - 16:00', status: 'Completed' },
    { id: 3, date: '23 Mar', location: 'Warehouse A', duration: '9h 30m', time: '07:30 - 17:00', status: 'Completed' },
    { id: 4, date: '21 Mar', location: 'Main Office', duration: '4h 00m', time: '08:00 - 12:00', status: 'Rejected' },
  ];

  return (
    <div className="space-y-4 px-1 pb-10">
      {/* HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest">Work History</p>
          <h1 className="text-gray-900 dark:text-white font-black text-2xl tracking-tight">My Shifts</h1>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm">
            <DownloadSimpleIcon weight="bold" className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </header>

      {/* STATS SUMMARY */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'This Month', value: '124h', color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Completed', value: '18', color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Avg. Shift', value: '7.5h', color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Earnings', value: '12.4k', color: 'text-emerald-600 dark:text-emerald-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-gray-800/40 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className={`text-2xl font-black tabular-nums ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* LIST */}
      <div className="space-y-2 mt-6">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-black dark:text-white flex items-center gap-2">
            History
          </h2>
          <button className="text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg">
            <FunnelIcon weight="bold" />
            Filter
          </button>
        </div>

        <div className="grid gap-2">
          {mockShifts.map((shift, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={shift.id}
              className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex flex-col items-center justify-center text-emerald-600 font-bold shrink-0">
                <CalendarIcon weight="bold" className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm dark:text-white truncate">{shift.location}</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{shift.date} • {shift.time}</p>
              </div>
              <div className="flex items-center gap-4 pr-1">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-black text-gray-900 dark:text-white">{shift.duration}</p>
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Work Time</p>
                </div>
                <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest ${
                  shift.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
                }`}>
                  {shift.status}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
