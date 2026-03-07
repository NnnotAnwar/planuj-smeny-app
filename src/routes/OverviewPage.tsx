import { useShiftContext } from "../context/ShiftContext";
import { type Shift } from "../types/types";


export function OverviewPage() {
    const { userShifts } = useShiftContext()

    const getTotalDuration = (shifts: Shift[]) => {
        let totalMilliseconds = 0;

        shifts.forEach(period => {
            if (!period.started_at || !period.ended_at) return;

            const startTime = new Date(period.started_at).getTime();
            const endTime = new Date(period.ended_at).getTime();

            if (!isNaN(startTime) && !isNaN(endTime) && endTime > startTime) {
                totalMilliseconds += (endTime - startTime);
            }
        });

        const totalMinutes = Math.floor(totalMilliseconds / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }

        return `${minutes}m`;
    }

    return (<div className="min-h-screen w-full font-sans md:flex md:flex-row transition-all duration-500 ease-in-out">
        {/* <Dashboard onLocationSelect={() => { }} /> */}
        <div className="flex-1 p-3 pb-32 md:p-6 md:pb-6 max-w-7xl transition-all duration-500 ease-in-out">
            <h1 className="text-black dark:text-white font-bold text-3xl">Overview</h1>
            <p className="text-white text-xl font-bold">{getTotalDuration(userShifts)}</p>
        </div>
    </div>)
}