import type { Shift } from '../types/types';
import LiveClockIcon from './LiveClockIcon';

interface ActiveShiftProps {
    activeShift: Shift | null;
    onEndShift: () => void;
    userName: string;
    userRole: string;
    locationName: string; // Restored location prop
}

export default function ActiveShift({
    activeShift,
    onEndShift,
    userName,
    userRole,
    locationName,
}: ActiveShiftProps) {

    // Format the start time
    const startTime = activeShift
        ? new Date(activeShift.started_at).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
        })
        : '';

    // 1. STATE: NO ACTIVE SHIFT
    if (!activeShift) {
        return (
            <div className="mb-6 flex justify-center">
                <div className="flex items-center gap-1.5 rounded-full bg-gray-200/50 px-3 py-1 text-sm font-medium text-gray-500">
                    {/* Static clock icon for inactive state */}
                    <LiveClockIcon className="h-4 w-4 text-gray-400" isActive={false} />
                    No Active Shift
                </div>
            </div>
        );
    }

    // 2. STATE: ACTIVE SHIFT
    return (
        <>
            {/* --- MOBILE VIEW: Small Badge (Hidden on Desktop) --- */}
            <div className="mb-6 flex justify-center md:hidden">
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                    {/* Animated clock icon */}
                    <LiveClockIcon className="h-4 w-4" isActive={true} />
                    Active Shift: {startTime}
                </div>
            </div>

            {/* --- DESKTOP/IPAD VIEW: Big Card (Hidden on Mobile) --- */}
            <div className="relative mb-8 hidden flex-col items-start justify-between gap-5 overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:flex md:flex-row md:items-center md:p-6">

                <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-emerald-500"></div>

                <div className="flex items-center gap-4 pl-2">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                        <LiveClockIcon className="h-6 w-6" isActive={true} />
                    </div>

                    <div>
                        <div className="mb-1 flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                                Active Shift
                            </span>
                        </div>
                        <h3 className="text-lg font-bold leading-tight text-gray-900">
                            {userName} <span className="ml-1 text-sm font-normal text-gray-500">({userRole})</span>
                        </h3>
                        <p className="mt-0.5 text-sm text-gray-500">
                            {locationName} • Started at {startTime}
                        </p>
                    </div>
                </div>

                {/* Desktop Button */}
                <div className="w-auto">
                    <button
                        onClick={onEndShift}
                        className="flex items-center justify-center gap-2 rounded-xl bg-red-500 px-8 py-3 font-medium text-white shadow-sm shadow-red-500/20 transition-all hover:bg-red-600 active:scale-95"
                    >
                        {/* Square Stop Icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                            <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                        </svg>
                        End Shift
                    </button>
                </div>
            </div>
        </>
    );
}