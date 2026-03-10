import { useMemo, useState } from "react";
import { useShiftContext } from "../context/ShiftContext";
import { motion } from "framer-motion";

export function OverviewPage() {
    const { userShifts } = useShiftContext();

    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    });

    const { minDate, maxDate } = useMemo(() => {
        if (!userShifts || userShifts.length === 0) {
            return { minDate: '', maxDate: '' };
        }

        const timestamps = userShifts
            .filter(s => s.ended_at)
            .map(s => new Date(s.ended_at!).getTime());

        if (timestamps.length === 0) {
            return { minDate: '', maxDate: '' };
        }

        const minTs = new Date(Math.min(...timestamps));
        const maxTs = new Date(Math.max(...timestamps));

        const formatToMonth = (date: Date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            return `${y}-${m}`;
        };

        return {
            minDate: formatToMonth(minTs),
            maxDate: formatToMonth(maxTs)
        };
    }, [userShifts]);

    const filteredShifts = useMemo(() => {
        return userShifts.filter(shift =>
            shift.ended_at && shift.ended_at.startsWith(selectedMonth)
        );
    }, [userShifts, selectedMonth]);

    const totalDuration = useMemo(() => {
        let totalMs = 0;
        filteredShifts.forEach(shift => {
            if (!shift.started_at || !shift.ended_at) return;
            const start = new Date(shift.started_at).getTime();
            const end = new Date(shift.ended_at).getTime();
            if (!isNaN(start) && !isNaN(end) && end > start) {
                totalMs += (end - start);
            }
        });

        const totalSeconds = Math.floor(totalMs / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;

        if (h > 0) {
            return `${h}h ${m}m ${s}s`;
        }
        return `${m}m ${s}s`;
    }, [filteredShifts]);

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10 max-w-full overflow-x-hidden px-1">
            {/* Header Section - More Compact */}
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 px-1">
                <div className="space-y-0.5">
                    <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest">Analytics</p>
                    <h1 className="text-gray-900 dark:text-white font-black text-2xl tracking-tight leading-none">Overview</h1>
                </div>

                <div className="relative group sm:min-w-[140px] w-full sm:w-auto">
                    <label
                        htmlFor="month-filter"
                        className="absolute -top-2 left-3 px-1 bg-gray-50 dark:bg-[#020617] text-[8px] font-black uppercase tracking-tighter text-gray-500 z-10"
                    >
                        Period
                    </label>
                    <input
                        id="month-filter"
                        type="month"
                        value={selectedMonth}
                        min={minDate}
                        max={maxDate}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white text-xs font-bold focus:outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            </header>

            {/* Stats Summary - Compact and Desktop Fit */}
            <div className="flex flex-wrap gap-3 px-1">
                <div className="bg-white dark:bg-gray-800/40 p-4 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm backdrop-blur-xl relative overflow-hidden group w-full sm:w-auto sm:min-w-[200px]">
                    <p className="text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">
                        Working Time
                    </p>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-emerald-600 dark:text-emerald-400 text-2xl font-black tabular-nums tracking-tight">
                            {totalDuration}
                        </span>
                    </div>
                    
                    <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-100 dark:border-emerald-500/20">
                        <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                        {filteredShifts.length} {filteredShifts.length === 1 ? 'Shift' : 'Shifts'}
                    </div>
                </div>
            </div>

            {/* Shift History Section */}
            <div className="space-y-3 px-1">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-base font-black text-gray-900 dark:text-white tracking-tight">History</h2>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                        {filteredShifts.length > 0 ? `${new Date(selectedMonth).toLocaleDateString('default', { month: 'short', year: 'numeric' })}` : 'Empty'}
                    </span>
                </div>

                {filteredShifts.length > 0 ? (
                    <div className="grid gap-2">
                        {filteredShifts.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()).map(shift => {
                            const start = new Date(shift.started_at);
                            const end = new Date(shift.ended_at!);
                            const durationMs = end.getTime() - start.getTime();
                            const durationH = Math.floor(durationMs / 3600000);
                            const durationM = Math.floor((durationMs % 3600000) / 60000);

                            return (
                                <motion.div 
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={shift.id} 
                                    className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800/30 rounded-[1.5rem] border border-gray-100 dark:border-gray-800 shadow-sm transition-all group"
                                >
                                    {/* Compact Recessed Date Badge */}
                                    <div className="relative w-11 h-11 shrink-0 rounded-[1rem] bg-emerald-50 dark:bg-[#062c22] border border-emerald-100/50 dark:border-emerald-900/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_4px_8px_rgba(0,0,0,0.3)] flex flex-col items-center justify-center">
                                        <span className="text-emerald-600 dark:text-emerald-400 text-base font-black leading-none">
                                            {start.getDate()}
                                        </span>
                                        <span className="text-emerald-600/60 dark:text-emerald-400/60 text-[8px] font-black uppercase tracking-tighter leading-none mt-0.5">
                                            {start.toLocaleDateString('en-GB', { month: 'short' })}
                                        </span>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-xs text-gray-900 dark:text-white truncate">
                                            {start.toLocaleDateString('en-GB', { weekday: 'short' })} Shift
                                        </p>
                                        <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-tight">
                                            {start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>

                                    <div className="text-right pr-1">
                                        <p className="text-xs font-black text-gray-900 dark:text-white tabular-nums">
                                            {durationH > 0 ? `${durationH}h ${durationM}m` : `${durationM}m`}
                                        </p>
                                        <p className="text-[8px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest leading-none mt-0.5">
                                            Done
                                        </p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-10 flex flex-col items-center justify-center text-center px-4">
                        <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800/50 rounded-full flex items-center justify-center mb-2 border border-gray-100 dark:border-gray-800">
                            <svg className="w-6 h-6 text-gray-200 dark:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h3 className="text-gray-400 dark:text-gray-700 text-xs font-bold">No records</h3>
                    </div>
                )}
            </div>
        </div>
    );
}
