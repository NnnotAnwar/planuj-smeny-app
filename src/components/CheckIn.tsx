import { type User } from "../types/types";

interface ShiftControlsProps {
    user: User;
    shiftStatusMessage: string;
    selectedLocationId: string | null;
    isShiftRunning: boolean | "" | null;
    handleStartShift: () => void;
    handleEndShift: () => void;
}

export default function CheckIn(props: ShiftControlsProps) {
    const { user, shiftStatusMessage, selectedLocationId, isShiftRunning, handleStartShift, handleEndShift } = props;
    return (
        <section className="block items-center
                fixed bottom-0 left-0 w-full z-40 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]
                md:static md:w-auto md:border md:rounded-lg md:shadow-sm md:flex md:flex-row md:items-center md:justify-between gap-4 transition-all
            ">
            {/* Статус смены */}
            <div className="mb-3 md:mb-0">
                <p className="text-sm font-semibold text-gray-700">
                    {user.username}, {user.role}:
                </p>
                <p className="text-sm text-gray-600 mt-1">{shiftStatusMessage}</p>
            </div>

            {/* Кнопки действий */}
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={handleStartShift}
                    className="flex-1 md:flex-none px-4 py-3 md:py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    disabled={isShiftRunning || !selectedLocationId}
                >
                    Start shift
                </button>
                <button
                    type="button"
                    onClick={handleEndShift}
                    className="flex-1 md:flex-none px-4 py-3 md:py-2 text-sm font-semibold rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    disabled={!isShiftRunning}
                >
                    End shift
                </button>
            </div>
        </section>
    )
}