import { type Shift } from '../types/types';

/**
 * ShiftCards Component
 * Displays all shifts for a specific location
 * Shows user's current shift in a highlighted card, then lists other employees' shifts
 */

/** Represents a single shift with employee and timing details */
/** Represents a single shift with employee and timing details */


/** Props for ShiftCards component */
interface ShiftCardsProps {
  locationName: string;                                    // Name of the location
  shifts: Shift[];                                         // Array of all shifts at this location
  userShift?: {                                           // Optional: current user's shift in this location
    name: string;
    role: string;
    start: string | null;
    end: string | null;
  };
}

/**
 * ShiftCards component
 * Renders a location card containing all shifts for that location
 * Highlights the current user's shift if they are scheduled here
 */
export default function ShiftCards({ locationName, shifts, userShift }: ShiftCardsProps) {
  /**
   * Returns CSS classes for badge styling based on employee role
   * Different roles get different colors for visual distinction
   * @param role - Employee role to style
   * @returns Tailwind CSS classes for badge styling
   */
  /**
   * Returns CSS classes for badge styling based on employee role
   * Different roles get different colors for visual distinction
   * @param role - Employee role to style
   * @returns Tailwind CSS classes for badge styling
   */
  const getRoleBadgeColor = (role: string) => {
    // Color mapping for different roles
    switch (role) {
      case 'Manager':
        return 'bg-purple-600 text-white';
      case 'Supervisor':
        return 'bg-emerald-500 text-white';
      case 'Waiter':
        return 'bg-lime-400 text-black';
      case 'Waitress':
        return 'bg-lime-400 text-black';
      default:
        return 'bg-red-100 text-red-700'; // Fallback color for unknown roles
    }
  };

  return (
    // ===== LOCATION CARD CONTAINER =====
    <div className="bg-gray-100 rounded-lg p-4 md:p-6">
      {/* ===== LOCATION HEADER ===== */}
      <h3 className="rounded bg-gray-800 px-4 py-3 text-white text-lg font-semibold mb-4 flex items-center justify-between">
        <span>{locationName}</span>
        <span className="text-xs font-normal text-gray-300">Today</span>
      </h3>

      {/* ===== SHIFTS GRID ===== */}
      <div className="grid grid-cols-1 gap-4">
        {/* ===== USER'S SHIFT CARD (highlighted in green) ===== */}
        {/* ===== USER'S SHIFT CARD (highlighted in green) ===== */}
        {userShift && (
          <div className="bg-emerald-50 p-4 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center gap-4 border border-emerald-200">
            {/* Time display box with green styling */}
            <div className="bg-emerald-100 rounded-lg min-w-40 h-16 px-4 py-3 flex border border-emerald-200 justify-between items-center">
              {/* Start time */}
              <div className="text-center">
                <span className="block text-xs font-medium text-emerald-700 uppercase tracking-wider mb-1">
                  In
                </span>
                <span className="text-lg font-semibold text-emerald-700">
                  {userShift.start ?? '--:--'}
                </span>
              </div>

              {/* Arrow separator */}
              <div className="text-emerald-400 px-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  ></path>
                </svg>
              </div>

              {/* End time */}
              <div className="text-center">
                <span className="block text-xs font-medium text-emerald-700 uppercase tracking-wider mb-1">
                  Out
                </span>
                <span className="text-lg font-semibold text-emerald-700">
                  {userShift.end ?? (userShift.start ? 'Ongoing' : '--:--')}
                </span>
              </div>
            </div>

            {/* User info section */}
            <div className="flex-1 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                  Your shift
                </p>
                <p className="text-lg font-bold text-gray-900 truncate">{userShift.name}</p>
              </div>
              {/* Role badge */}
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(
                  userShift.role,
                )}`}
              >
                {userShift.role}
              </span>
            </div>
          </div>
        )}

        {/* ===== OTHER EMPLOYEE SHIFTS ===== */}
        {/* Iterate through all shifts and display them */}
        {shifts.map((shift) => {
          // Handle unassigned shifts (no start time) with special styling
          if (shift.start === null) {
            return (
              <div
                key={shift.id}
                className="bg-yellow-50 p-4 rounded-lg shadow-sm flex md:flex-row flex-col md:items-center justify-between gap-4"
              >
                {/* Clock icon for unassigned shifts */}
                <div className="bg-gray-50 rounded-lg p-3 md:min-w-42 min-w-16 h-16 flex border border-gray-300 items-center justify-center">
                  <svg
                    className="w-6 h-6 text-yellow-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                </div>
                <div className="flex-1 flex items-center justify-between gap-3">
                  <p className="flex-1 text-lg font-bold text-gray-900 truncate">{shift.name}</p>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(
                      shift.role,
                    )}`}
                  >
                    {shift.role}
                  </span>
                </div>
              </div>
            );
          }

          // Regular shift with start and end times
          return (
            <div
              key={shift.id}
              className="bg-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center gap-4"
            >
              {/* ===== TIME DISPLAY SECTION ===== */}
              <div className="bg-gray-50 rounded-lg min-w-40 h-16 px-4 py-3 flex border border-gray-200 justify-between items-center">
                {/* Start time */}
                <div className="text-center">
                  <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                    In
                  </span>
                  <span className="text-lg font-semibold text-emerald-600">{shift.start}</span>
                </div>

                {/* Arrow icon */}
                <div className="text-gray-300 px-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    ></path>
                  </svg>
                </div>

                {/* End time */}
                <div className="text-center">
                  <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                    Out
                  </span>
                  <span className="text-lg font-semibold text-gray-800">
                    {shift.end || 'Ongoing'}
                  </span>
                </div>
              </div>

              {/* ===== EMPLOYEE INFO SECTION ===== */}
              <div className="flex-1 flex items-center justify-between gap-3">
                <p className="text-lg font-bold text-gray-900 truncate">{shift.name}</p>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(
                    shift.role,
                  )}`}
                >
                  {shift.role}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}