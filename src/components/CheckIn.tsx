interface CheckInProps {
  selectedLocationId: string | null;
  isShiftRunning: boolean;
  handleStartShift: () => void;
  handleEndShift: () => void; // Keeping this for prop compatibility, though mostly unused here now
}

export default function CheckIn({
  selectedLocationId,
  isShiftRunning,
  handleStartShift,
}: CheckInProps) {
  // If shift is running, hide this completely
  if (isShiftRunning) return null;

  return (
    <div className="mb-8 flex flex-col items-center">
      <button
        onClick={handleStartShift}
        disabled={!selectedLocationId}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-8 py-3 font-medium text-white shadow-sm transition-all active:scale-95 md:w-auto ${selectedLocationId
            ? 'bg-emerald-500 shadow-emerald-500/20 hover:bg-emerald-600'
            : 'cursor-not-allowed bg-gray-300'
          }`}
      >
        {/* Triangle Play Icon */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
        </svg>
        Start Shift
      </button>

      {!selectedLocationId && (
        <p className="mt-3 text-sm text-gray-500 md:hidden">
          Select a location below to start
        </p>
      )}
    </div>
  );
}