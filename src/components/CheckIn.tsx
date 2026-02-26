/** Props for the check-in bar: user, status text, and shift actions. */
interface CheckInProps {
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
  selectedLocationId,
  isShiftRunning,
  handleStartShift,
  handleEndShift,
}: CheckInProps) {
  return (
    <section
      className="block bg-white fixed md:static bottom-0 left-0 w-full z-40 border-t-gray-400 py-3 px-6 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] gap-4 transition-all"
    >

      <div className="flex flex-row gap-3">
        <button
          type="button"
          onClick={handleStartShift}
          className={`${!isShiftRunning ? 'block' : 'hidden'} flex-1 p-4 text-sm font-semibold rounded-xl bg-emerald-500 text-white hover:bg-emerald-700 shadow-sm disabled:cursor-not-allowed transition-colors`}
          disabled={isShiftRunning || !selectedLocationId}
        >
          Start shift
        </button>
        <button
          type="button"
          onClick={handleEndShift}
          className={`${isShiftRunning ? 'block' : 'hidden'} flex-1 p-4 text-sm font-semibold rounded-xl bg-red-500 text-white hover:bg-red-700 shadow-sm disabled:cursor-not-allowed transition-colors`}
          disabled={!isShiftRunning}
        >
          End shift
        </button>
      </div>
    </section >
  );
}
