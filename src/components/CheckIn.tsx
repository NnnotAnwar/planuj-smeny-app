import { type User } from '../types/types';

/** Props for the check-in bar: user, status text, and shift actions. */
interface CheckInProps {
  user: User;
  shiftStatusMessage: string;
  selectedLocationId: string | null;
  isShiftRunning: boolean;
  handleStartShift: () => void;
  handleEndShift: () => void;
}

/**
 * Fixed (mobile) or inline (desktop) bar showing shift status and Start/End shift buttons.
 * Start disabled until a location is selected; End disabled when no shift is running.
 */
export default function CheckIn({
  user,
  shiftStatusMessage,
  selectedLocationId,
  isShiftRunning,
  handleStartShift,
  handleEndShift,
}: CheckInProps) {
  return (
    <section
      className="block items-center fixed bottom-0 left-0 w-full z-40 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]
        md:static md:w-auto md:border md:rounded-lg md:shadow-sm md:flex md:flex-row md:items-center md:justify-between gap-4 transition-all"
    >
      <div className="mb-3 md:mb-0">
        <p className="text-sm font-semibold text-gray-700">
          {user.username}, {user.role}:
        </p>
        <p className="text-sm text-gray-600 mt-1">{shiftStatusMessage}</p>
      </div>

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
  );
}
