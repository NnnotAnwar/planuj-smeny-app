interface CheckInProps {
  selectedLocationId: string | null;
  isShiftRunning: boolean;
  handleStartShift: () => void;
  handleEndShift: () => void;
}

export default function CheckIn({
  selectedLocationId,
  isShiftRunning,
  handleStartShift,
}: CheckInProps) {
  // If shift is running, hide this component completely
  if (isShiftRunning) return null;

  const isDisabled = !selectedLocationId;

  // Dynamic classes for colors based on selection state
  const buttonClasses = isDisabled
    ? 'cursor-not-allowed bg-gray-300 text-gray-500 shadow-none'
    : 'bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600';

  return (
    <>
      {/* --- DESKTOP VIEW: Inline Button (Hidden on Mobile) --- */}
      <div className="mb-8 hidden flex-col items-center md:flex">
        <button
          onClick={handleStartShift}
          disabled={isDisabled}
          className={`flex w-auto items-center justify-center gap-2 rounded-xl px-8 py-3 font-medium shadow-sm transition-all active:scale-95 ${buttonClasses}`}
        >
          {/* Triangle Play Icon */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
          </svg>
          Start Shift
        </button>
      </div>

      {/* --- MOBILE VIEW: Sticky Bottom Button (Hidden on Desktop) --- */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white p-4 pb-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:hidden">
        <button
          onClick={handleStartShift}
          disabled={isDisabled}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-8 py-4 text-lg font-bold shadow-sm transition-all active:scale-95 ${buttonClasses}`}
        >
          {/* Triangle Play Icon */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
            <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
          </svg>
          Start Shift
        </button>
        {/* Helper text if no location is selected */}
        {isDisabled && (
          <p className="mt-2 text-center text-xs text-gray-500">
            Select a location to start
          </p>
        )}
      </div>
    </>
  );
}