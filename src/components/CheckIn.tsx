import { useShiftContext } from '../context/ShiftContext';

export default function CheckIn() {
  const { selectedLocationId, activeShift, handleStartShift, isStarting } = useShiftContext();

  // If shift is running, hide this component completely
  if (activeShift) return null;

  const isDisabled = !selectedLocationId || isStarting;

  // Dynamic classes for colors based on selection state
  const buttonClasses = isDisabled
    ? 'cursor-not-allowed bg-gray-300 dark:bg-gray-800 text-gray-500 dark:text-gray-600 shadow-none'
    : 'bg-linear-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 cursor-pointer';

  return (
    <>
      {/* --- DESKTOP VIEW: Inline Button (Hidden on Mobile) --- */}
      <div className="mb-8 hidden flex-col items-center md:flex">
        <button
          onClick={handleStartShift}
          disabled={isDisabled}
          className={`flex w-auto items-center justify-center gap-2 rounded-xl px-8 py-3 font-medium shadow-sm transition-all active:scale-95 ${buttonClasses}`}
        >
          {/* Triangle Play Icon or Spinner */}
          {isStarting ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
            </svg>
          )}
          {isStarting ? 'Starting...' : 'Start Shift'}
        </button>
      </div>

      {/* --- MOBILE VIEW: Sticky Bottom Button (Hidden on Desktop) --- */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 dark:border-white/10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl md:hidden transition-all duration-300">
        <button
          onClick={handleStartShift}
          disabled={isDisabled}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl px-8 py-4 text-lg font-bold shadow-lg transition-all active:scale-[0.98] ${buttonClasses}`}
        >
          {isStarting ? (
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-gray-400 border-t-transparent"></div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
            </svg>
          )}
          {isStarting ? 'Starting...' : 'Start Shift'}
        </button>
        {/* Helper text if no location is selected */}
        {!selectedLocationId && !isStarting && (
          <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-300 font-medium">
            Select a location to start
          </p>
        )}
      </div>
    </>
  );
}
