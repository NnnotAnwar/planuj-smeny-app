import { useMemo, useState } from "react";
import { useShiftContext } from "../shifts/ShiftContext";
import { motion } from "framer-motion";

/**
 * --- OVERVIEW PAGE ---
 * Shows analytics and history of past shifts.
 * Users can filter by month.
 */

export function OverviewPage() {
    const { userShifts, locations } = useShiftContext();

    // 1. STATE: Selected month (YYYY-MM).
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    });

    // 2. LOGIC: Find the oldest and newest shift to set limits on the month picker.
    const { minDate, maxDate } = useMemo(() => {
        if (!userShifts || userShifts.length === 0) return { minDate: '', maxDate: '' };

        const timestamps = userShifts
            .filter(s => s.ended_at)
            .map(s => new Date(s.ended_at!).getTime());

        if (timestamps.length === 0) return { minDate: '', maxDate: '' };

        const minTs = new Date(Math.min(...timestamps));
        const maxTs = new Date(Math.max(...timestamps));

        const format = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return { minDate: format(minTs), maxDate: format(maxTs) };
    }, [userShifts]);

    // 3. LOGIC: Filter shifts based on the selected month.
    const filteredShifts = useMemo(() => {
        return userShifts.filter(shift =>
            shift.ended_at && shift.ended_at.startsWith(selectedMonth)
        );
    }, [userShifts, selectedMonth]);

    // 4. LOGIC: Calculate total working time for the selected month.
    const totalDuration = useMemo(() => {
        let totalMs = 0;
        filteredShifts.forEach(shift => {
            if (!shift.started_at || !shift.ended_at) return;
            const start = new Date(shift.started_at).getTime();
            const end = new Date(shift.ended_at).getTime();
            if (end > start) totalMs += (end - start);
        });

        const totalSeconds = Math.floor(totalMs / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }, [filteredShifts]);

    return (
        <div className="space-y-4 px-1 pb-10">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div className="space-y-0.5">
                    <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest">Analytics</p>
                    <h1 className="text-gray-900 dark:text-white font-black text-2xl tracking-tight">Overview</h1>
                </div>

                <div className="relative w-full sm:w-auto">
                    <input
                        type="month"
                        value={selectedMonth}
                        min={minDate}
                        max={maxDate}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full sm:w-40 px-3 py-2 rounded-xl border-2 border-gray-100 dark:border-gray-800 dark:bg-gray-950 dark:text-white text-xs font-bold outline-none focus:border-emerald-500/50"
                    />
                </div>
            </header>

            {/* SUMMARY BOX */}
            <div className="bg-white dark:bg-gray-800/40 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm w-full sm:w-64">
                <p className="text-gray-400 text-[10px] font-black uppercase mb-1">Working Time</p>
                <span className="text-emerald-600 dark:text-emerald-400 text-2xl font-black tabular-nums">{totalDuration}</span>
                <div className="mt-2 text-[10px] font-bold text-gray-400">{filteredShifts.length} shifts completed</div>
            </div>

            {/* HISTORY LIST */}
            <div className="space-y-2">
                <h2 className="text-base font-black dark:text-white">History</h2>
                {filteredShifts.length > 0 ? (
                    <div className="grid gap-2">
                        {filteredShifts.sort((a,b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()).map(shift => {
                            const start = new Date(shift.started_at);
                            const end = new Date(shift.ended_at!);
                            const loc = locations.find(l => l.id === shift.location_id)?.name;
                            return (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={shift.id} className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex flex-col items-center justify-center text-emerald-600 font-bold">
                                        <span className="text-sm">{start.getDate()}</span>
                                        <span className="text-[8px] uppercase">{start.toLocaleDateString('en-GB', { month: 'short' })}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm dark:text-white truncate">{loc}</p>
                                        <p className="text-xs text-gray-400">{start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {end.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-center py-10 text-gray-400 text-sm">No records found for this month.</p>
                )}
            </div>
        </div>
    );
}
