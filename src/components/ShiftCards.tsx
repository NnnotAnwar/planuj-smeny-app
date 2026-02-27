import { type ShiftDisplayData } from '../types/types';

interface ShiftCardsProps {
  locationName: string;
  shifts: ShiftDisplayData[];
  userShift?: ShiftDisplayData;
}

const ROLE_COLORS: Record<string, string> = {
  Manager: 'bg-purple-600 text-white',
  Supervisor: 'bg-emerald-500 text-white',
  Waiter: 'bg-lime-400 text-black',
  Waitress: 'bg-lime-400 text-black',
};

function getRoleBadgeColor(role: string): string {
  return ROLE_COLORS[role] || 'bg-red-100 text-red-700';
}

export default function ShiftCards({ locationName, shifts, userShift }: ShiftCardsProps) {
  if (shifts.length === 0 && !userShift) return null;

  return (
    <div className="rounded-lg bg-gray-100 p-0 md:p-4">
      <h3 className="mb-2 flex items-center justify-between rounded bg-gray-800 px-2 py-1.5 text-sm font-semibold text-white">
        <span>{locationName}</span>
      </h3>

      <div className="grid grid-cols-1 gap-2">
        {userShift && <UserShiftCard userShift={userShift} />}

        {shifts.map((shift) =>
          shift.start === null ? (
            <UnassignedShiftCard key={shift.id} shift={shift} />
          ) : (
            <AssignedShiftCard key={shift.id} shift={shift} />
          )
        )}
      </div>
    </div>
  );
}

function UserShiftCard({ userShift }: { userShift: NonNullable<ShiftCardsProps['userShift']> }) {
  const isEmerald = !userShift.isChangeLocation;
  const bg = isEmerald ? 'bg-emerald-50' : 'bg-yellow-50';
  const box = isEmerald
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-yellow-100 border-yellow-200 text-yellow-700';
  const label = isEmerald ? 'text-emerald-700' : 'text-yellow-700';

  return (
    <div className={`flex flex-col gap-4 rounded-lg p-1.5 shadow-sm md:flex-row md:items-center ${bg}`}>
      <div className={`flex items-center justify-between rounded-lg px-2 py-1 ${box}`}>
        <div className="text-center">
          <span className={`text-sm font-semibold ${label}`}>{userShift.start ?? '--:--'}</span>
        </div>
      </div>
      <div className="flex w-full items-center">
        <div className="flex flex-1 items-center gap-3">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${label}`}>Your shift</p>
            <p className="truncate text-sm font-bold text-gray-900">{userShift.name}</p>
          </div>
        </div>
        <div className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getRoleBadgeColor(userShift.role)}`}>
          {userShift.role}
        </div>
      </div>
    </div>
  );
}

function AssignedShiftCard({ shift }: { shift: ShiftDisplayData }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg p-1.5 shadow-sm md:flex-row md:items-center">
      <div className="flex items-center justify-between rounded-lg bg-gray-400 px-2 py-1 text-black">
        <div className="text-center">
          <span className="text-sm font-semibold">{shift.start ?? '--:--'}</span>
        </div>
      </div>
      <div className="flex w-full items-center">
        <div className="flex flex-1 items-center gap-3">
          <p className="truncate text-sm font-bold text-gray-900">{shift.name}</p>
        </div>
        <div className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getRoleBadgeColor(shift.role)}`}>
          {shift.role}
        </div>
      </div>
    </div>
  );
}

function UnassignedShiftCard({ shift }: { shift: ShiftDisplayData }) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-lg bg-yellow-50 p-4 shadow-sm md:flex-row md:items-center">
      <div className="flex h-16 min-w-16 items-center justify-center rounded-lg border border-gray-300 bg-gray-50 p-3 md:min-w-42">
        <svg className="h-6 w-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex flex-1 items-center justify-between">
        <p className="flex-1 truncate text-lg font-bold text-gray-900">{shift.name}</p>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getRoleBadgeColor(shift.role)}`}>
          {shift.role}
        </span>
      </div>
    </div>
  );
}