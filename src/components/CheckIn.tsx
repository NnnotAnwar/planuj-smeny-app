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
      className="block fixed bottom-0 left-0 w-full z-40 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]
    lg:static lg:w-auto lg:border lg:rounded-lg lg:shadow-sm lg:flex lg:flex-row lg:items-center lg:justify-between gap-4 transition-all"
    >
      {/* Текст: отступ снизу работает до lg */}
      <div className="mb-3 lg:mb-0">
        <p className="text-sm font-semibold text-gray-700">
          {user.username}, {user.role}:
        </p>
        <p className="text-sm text-gray-600 mt-1">{shiftStatusMessage}</p>
      </div>

      {/* Кнопки: убрана опечатка ms:flex-row, добавлено запрет на сжатие (shrink-0) на больших экранах */}
      <div className="flex flex-row gap-3 lg:shrink-0">
        <button
          type="button"
          onClick={handleStartShift}
          className="flex-1 lg:flex-none px-4 py-3 lg:py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          disabled={isShiftRunning || !selectedLocationId}
        >
          Start shift
        </button>
        <button
          type="button"
          onClick={handleEndShift}
          className="flex-1 lg:flex-none px-4 py-3 lg:py-2 text-sm font-semibold rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          disabled={!isShiftRunning}
        >
          End shift
        </button>
      </div>
    </section>
  );
}
