import { LiveClockIcon } from '@shared/components/LiveClockIcon';
import { useAuthContext } from '../../auth/AuthContext';
import { useShiftContext } from '../ShiftContext';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

import { formatTime } from '@shared/utils/date';

/**
 * --- ACTIVE SHIFT COMPONENT ---
 * Shows the status of the current shift. 
 * If a shift is running, it shows a "Stop" button.
 */

export function ActiveShift() {
    const { user } = useAuthContext();
    const { activeShift, handleEndShift, locations, isEnding } = useShiftContext();

    // 1. Logic to disable the button while ending or if no shift is active.
    const isDisabled = !activeShift || isEnding

    const buttonClasses = isDisabled
        ? 'cursor-not-allowed bg-gray-300 dark:bg-gray-800 text-gray-500 dark:text-gray-600 shadow-none'
        : 'bg-red-500 bg-linear-to-r from-red-500 to-rose-600 cursor-pointer hover:bg-red-600'

    if (!user) return null;

    /**
     * Handler: When user clicks "End Shift".
     * Includes haptic feedback (vibration) for mobile users.
     */
    const onEndShiftClick = async () => {
        if (Capacitor.isNativePlatform()) {
            try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch (e) { console.warn(e); }
        }
        handleEndShift();
    };

    // Format the start time for the UI using our shared utility.
    const startTime = formatTime(activeShift?.started_at);

    const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
    const location = locations.find(l => l.id === activeShift?.location_id);
    const locationName = location?.name || 'Unknown Location';
    const previousLocation = activeShift?.previous_location_id ? locations.find(l => l.id === activeShift.previous_location_id) : null;

    // RENDER: If no shift is active, show a small status badge.
    if (!activeShift) {
        return (
            <div className="mb-6 flex justify-center">
                <div className="flex items-center gap-1.5 rounded-full bg-gray-200/50 dark:bg-gray-800/50 px-3 py-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                    <LiveClockIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" isActive={false} />
                    No Active Shift
                </div>
            </div>
        );
    }

    return (
        <>
            {/* --- MOBILE VIEW --- */}
            <div className="mb-6 flex flex-col items-center md:hidden">
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    <LiveClockIcon className="h-4 w-4" isActive={true} />
                    Active Shift: {startTime}
                </div>
                {previousLocation && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                        <span>Moved from {previousLocation.name}</span>
                    </div>
                )}
            </div>

            {/* --- DESKTOP VIEW --- */}
            <div className="relative mb-8 hidden flex-col items-start justify-between gap-5 overflow-hidden rounded-2xl border border-emerald-500/10 dark:border-white/5 bg-white/40 dark:bg-white/5 backdrop-blur-md p-5 shadow-xl shadow-emerald-500/5 md:flex md:flex-row md:items-center md:p-6 transition-all duration-300">
                <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-linear-to-b from-emerald-500 to-teal-600"></div>
                <div className="flex items-center gap-4 pl-2">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <LiveClockIcon className="h-6 w-6" isActive={true} />
                    </div>
                    <div>
                        <div className="mb-1 flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                Active Shift
                            </span>
                            {previousLocation && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tight">
                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                                    </svg>
                                    Moved from {previousLocation.name}
                                </span>
                            )}
                        </div>
                        <h3 className="text-lg font-bold leading-tight text-gray-800 dark:text-white">
                            {userName} <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400">({user.role.name})</span>
                        </h3>
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 font-medium">
                            {locationName} • Started at {startTime}
                        </p>
                    </div>
                </div>
                <div className="w-full md:w-auto shrink-0">
                    <button
                        onClick={onEndShiftClick}
                        disabled={isDisabled}
                        className={`flex w-full md:w-auto items-center justify-center gap-2 rounded-xl px-6 md:px-8 py-3.5 font-bold text-white shadow-lg shadow-red-500/20 transition-all hover:scale-[1.02] active:scale-95 whitespace-nowrap ${buttonClasses}`}
                    >
                        {isEnding ? (
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></div>
                        ) :
                            (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                                <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                            </svg>)}
                        <span>{isEnding ? 'Ending...' : 'End Shift'}</span>
                    </button>
                </div>
            </div>

            {/* --- MOBILE STICKY BUTTON --- */}
            <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 dark:border-white/10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl md:hidden transition-all duration-300">
                <button
                    onClick={onEndShiftClick}
                    disabled={isDisabled}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl px-8 py-4 text-lg font-bold text-white shadow-lg shadow-red-500/30 transition-all active:scale-[0.98] ${buttonClasses}`}
                >
                    {isEnding ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></div>
                    ) :
                        (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                                <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                            </svg>)}
                    <span>{isEnding ? 'Ending...' : 'End Shift'}</span>
                </button>
            </div>
        </>
    );
}
