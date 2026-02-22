import { type Shift } from '../types/types';

/** Props for a location's shift list and optional current user shift. */
interface ShiftCardsProps {
  locationName: string;
  shifts: Shift[];
  userShift?: {
    name: string;
    role: string;
    start: string | null;
    end: string | null;
    isChangeLocation: boolean;
  };
}

/** Tailwind badge classes by role; fallback for unknown roles. */
function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'Manager':
      return 'bg-purple-600 text-white';
    case 'Supervisor':
      return 'bg-emerald-500 text-white';
    case 'Waiter':
    case 'Waitress':
      return 'bg-lime-400 text-black';
    default:
      return 'bg-red-100 text-red-700';
  }
}

const TIME_ARROW = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

/**
 * One location block: header + list of shift cards.
 * Renders user's shift (emerald or yellow if isChangeLocation) then other employees.
 * Unassigned shifts (no start) get a distinct yellow style.
 */
export default function ShiftCards({ locationName, shifts, userShift }: ShiftCardsProps) {
  const endLabel = (start: string | null, end: string | null) =>
    end ?? (start ? 'Ongoing' : '--:--');

  return (
    <div className="bg-gray-100 rounded-lg p-0 lg:p-4">
      <h3 className="rounded bg-gray-800 px-4 py-3 text-white text-lg font-semibold mb-4 flex items-center justify-between">
        <span>{locationName}</span>
        <span className="text-xs font-normal text-gray-300">Today</span>
      </h3>

      <div className="grid grid-cols-1 gap-4">
        {userShift && (
          <UserShiftCard
            userShift={userShift}
            variant={userShift.isChangeLocation ? 'yellow' : 'emerald'}
            getRoleBadgeColor={getRoleBadgeColor}
            endLabel={endLabel(userShift.start, userShift.end)}
          />
        )}

        {shifts.map((shift) =>
          shift.start === null ? (
            <UnassignedShiftCard key={shift.id} shift={shift} getRoleBadgeColor={getRoleBadgeColor} />
          ) : (
            <AssignedShiftCard key={shift.id} shift={shift} getRoleBadgeColor={getRoleBadgeColor} />
          ),
        )}
      </div>
    </div>
  );
}

interface UserShiftCardProps {
  userShift: NonNullable<ShiftCardsProps['userShift']>;
  variant: 'emerald' | 'yellow';
  getRoleBadgeColor: (role: string) => string;
  endLabel: string;
}

function UserShiftCard({ userShift, variant, getRoleBadgeColor, endLabel }: UserShiftCardProps) {
  const isEmerald = variant === 'emerald';
  const bg = isEmerald ? 'bg-emerald-50 border-emerald-200' : 'bg-yellow-50 border-yellow-200';
  const box = isEmerald ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-yellow-100 border-yellow-200 text-yellow-700';
  const arrow = isEmerald ? 'text-emerald-400' : 'text-yellow-400';
  const label = isEmerald ? 'text-emerald-700' : 'text-yellow-700';

  return (
    <div className={`${bg} p-4 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center gap-4 border`}>
      <div className={`${box} rounded-lg min-w-40 h-16 px-4 py-3 flex border justify-between items-center`}>
        <div className="text-center">
          <span className={`block text-xs font-medium ${label} uppercase tracking-wider mb-1`}>In</span>
          <span className={`text-lg font-semibold ${label}`}>{userShift.start ?? '--:--'}</span>
        </div>
        <div className={`${arrow} px-2`}>{TIME_ARROW}</div>
        <div className="text-center">
          <span className={`block text-xs font-medium ${label} uppercase tracking-wider mb-1`}>Out</span>
          <span className={`text-lg font-semibold ${label}`}>{endLabel}</span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold ${label} uppercase tracking-wide`}>Your shift</p>
          <p className="text-lg font-bold text-gray-900 truncate">{userShift.name}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(userShift.role)}`}>
          {userShift.role}
        </span>
      </div>
    </div>
  );
}

function UnassignedShiftCard({
  shift,
  getRoleBadgeColor,
}: {
  shift: Shift;
  getRoleBadgeColor: (role: string) => string;
}) {
  return (
    <div className="bg-yellow-50 p-4 rounded-lg shadow-sm flex md:flex-row flex-col md:items-center justify-between gap-4">
      <div className="bg-gray-50 rounded-lg p-3 md:min-w-42 min-w-16 h-16 flex border border-gray-300 items-center justify-center">
        <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex-1 flex items-center justify-between gap-3">
        <p className="flex-1 text-lg font-bold text-gray-900 truncate">{shift.name}</p>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(shift.role)}`}>
          {shift.role}
        </span>
      </div>
    </div>
  );
}

function AssignedShiftCard({
  shift,
  getRoleBadgeColor,
}: {
  shift: Shift;
  getRoleBadgeColor: (role: string) => string;
}) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center gap-4">
      <div className="bg-gray-50 rounded-lg min-w-40 h-16 px-4 py-3 flex border border-gray-200 justify-between items-center">
        <div className="text-center">
          <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">In</span>
          <span className="text-lg font-semibold text-emerald-600">{shift.start}</span>
        </div>
        <div className="text-gray-300 px-2">{TIME_ARROW}</div>
        <div className="text-center">
          <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Out</span>
          <span className="text-lg font-semibold text-gray-800">{shift.end ?? 'Ongoing'}</span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-between gap-3">
        <p className="text-lg font-bold text-gray-900 truncate">{shift.name}</p>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getRoleBadgeColor(shift.role)}`}>
          {shift.role}
        </span>
      </div>
    </div>
  );
}
