import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { type ShiftDisplayData } from '@shared/types';

/**
 * --- SHIFT CARDS COMPONENT ---
 * Displays a list of shifts for a specific location. 
 * Shows your own shift at the top if you're there.
 */

interface ShiftCardsProps {
  locationName: string;
  shifts: ShiftDisplayData[]; // Other workers.
  userShift?: ShiftDisplayData; // Your own shift.
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

// 2. ANIMATION: Define how cards should slide in and out.
const itemVariants: Variants = {
  hidden: { opacity: 0, x: -20, height: 0, marginTop: 0 },
  show: { opacity: 1, x: 0, height: 'auto', marginTop: 8 },
  exit: { opacity: 0, x: 20, height: 0, marginTop: 0 },
};

export function ShiftCards({ locationName, shifts, userShift }: ShiftCardsProps) {
  const hasContent = shifts.length > 0 || userShift;

  return (
    <motion.div 
      layout
      initial={false}
      animate={{ 
        opacity: hasContent ? 1 : 0,
        height: hasContent ? 'auto' : 0,
        marginBottom: hasContent ? 16 : 0,
        display: hasContent ? 'block' : 'none'
      }}
      className="rounded-xl bg-white/40 dark:bg-white/5 backdrop-blur-md p-0 md:p-4 border border-emerald-500/10 dark:border-white/5 overflow-hidden shadow-xl shadow-emerald-500/5"
    >
      <h3 className="mb-2 flex items-center justify-between rounded-lg bg-gray-800 dark:bg-gray-800/90 px-3 py-1.5 text-sm font-semibold text-white border border-gray-700 shadow-md">
        <span>{locationName}</span>
      </h3>

      <motion.div layout className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {/* OWN SHIFT FIRST */}
          {userShift && (
            <motion.div key="user-active-shift" variants={itemVariants} initial="hidden" animate="show" exit="exit" layout>
              <UserShiftCard userShift={userShift} />
            </motion.div>
          )}

          {/* COLLEAGUES SECOND */}
          {shifts.map((shift) => (
            <motion.div key={shift.id || `${shift.name}-${shift.start}`} variants={itemVariants} initial="hidden" animate="show" exit="exit" layout>
              {shift.start === '--:--' ? (
                <UnassignedShiftCard shift={shift} />
              ) : (
                <AssignedShiftCard shift={shift} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/**
 * UI for YOUR OWN active shift card.
 */
function UserShiftCard({ userShift }: { userShift: NonNullable<ShiftCardsProps['userShift']> }) {
  const isEmerald = !userShift.isChangeLocation;
  const bg = isEmerald 
    ? 'bg-linear-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30' 
    : 'bg-linear-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30';
  const box = isEmerald
    ? 'bg-emerald-500 text-white shadow-md'
    : 'bg-yellow-500 text-white shadow-md';
  const label = isEmerald 
    ? 'text-emerald-700 dark:text-emerald-300' 
    : 'text-yellow-700 dark:text-yellow-300';

  return (
    <div className={`flex flex-row gap-4 rounded-lg p-1.5 shadow-sm md:items-center transition-all border border-white dark:border-white/5 backdrop-blur-sm ${bg}`}>
      <div className={`flex items-center justify-between rounded-lg px-2 py-1 ${box}`}>
        <div className="text-center">
          <span className="text-sm font-bold">{userShift.start ?? '--:--'}</span>
        </div>
      </div>
      <div className="flex w-full items-center">
        <div className="flex flex-1 items-center gap-3">
          <div>
            <p className={`text-[10px] font-bold ${label}`}>Your shift</p>
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold text-gray-800 dark:text-white">{userShift.name}</p>
              {userShift.previousLocationName && (
                <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-200/50 dark:bg-gray-800/50 rounded-md px-1.5">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                  <span>from {userShift.previousLocationName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className={`rounded-full px-2.5 py-1 text-xs font-semibold shadow-xs ${getRoleBadgeColor(userShift.role)}`}>
          {userShift.role}
        </div>
      </div>
    </div>
  );
}

/**
 * UI for a COLLEAGUE'S shift card.
 */
function AssignedShiftCard({ shift }: { shift: ShiftDisplayData }) {
  return (
    <div className="flex flex-row gap-4 rounded-lg p-1.5 shadow-sm md:items-center bg-white/80 dark:bg-white/5 backdrop-blur-sm transition-all border border-white dark:border-white/5">
      <div className="flex items-center justify-between rounded-lg bg-linear-to-br from-gray-400 to-gray-500 dark:from-gray-700 dark:to-gray-800 px-2 py-1 text-white shadow-xs">
        <div className="text-center">
          <span className="text-sm font-bold">{shift.start ?? '--:--'}</span>
        </div>
      </div>
      <div className="flex w-full items-center">
        <div className="flex flex-1 items-center gap-3">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-gray-800 dark:text-white">{shift.name}</p>
            {shift.previousLocationName && (
              <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-100 dark:bg-gray-800/80 rounded-md px-1.5">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
                <span>from {shift.previousLocationName}</span>
              </div>
            )}
          </div>
        </div>
        <div className={`rounded-full px-2.5 py-1 text-xs font-semibold shadow-xs ${getRoleBadgeColor(shift.role)}`}>
          {shift.role}
        </div>
      </div>
    </div>
  );
}

function UnassignedShiftCard({ shift }: { shift: ShiftDisplayData }) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-4 shadow-sm md:flex-row md:items-center transition-colors">
      <div className="flex h-16 min-w-16 items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 md:min-w-42">
        <svg className="h-6 w-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex flex-1 items-center justify-between">
        <p className="flex-1 truncate text-lg font-bold text-gray-900 dark:text-white">{shift.name}</p>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getRoleBadgeColor(shift.role)}`}>
          {shift.role}
        </span>
      </div>
    </div>
  );
}
