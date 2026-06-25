import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { type ShiftDisplayData } from '@shared/types';
import { getRoleBadgeColor } from '@/shared/utils/roleColors';

/**
 * --- SHIFT CARDS COMPONENT ---
 * Displays a list of shifts for a specific location. 
 * Shows your own shift at the top if you're there.
 */

interface ShiftCardsProps {
  locationName: string;
  shifts: ShiftDisplayData[]; // Other workers.
  userShift?: ShiftDisplayData; // Your own shift.
  onSelectUser?: (userId: string) => void; // Open a worker's profile modal.
}

// 2. ANIMATION: Define how cards should slide in and out.
const itemVariants: Variants = {
  hidden: { opacity: 0, x: -20, height: 0, marginTop: 0 },
  show: { opacity: 1, x: 0, height: 'auto', marginTop: 8 },
  exit: { opacity: 0, x: 20, height: 0, marginTop: 0 },
};

export function ShiftCards({ locationName, shifts, userShift, onSelectUser }: ShiftCardsProps) {
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
      <h3 className="mb-2 flex items-center justify-between rounded-lg bg-gray-800 dark:bg-gray-800/90 px-3 py-1.5 text-body-strong text-white border border-gray-700 shadow-md">
        <span>{locationName}</span>
      </h3>

      <motion.div layout className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {/* OWN SHIFT FIRST */}
          {userShift && (
            <motion.div key="user-active-shift" variants={itemVariants} initial="hidden" animate="show" exit="exit" layout>
              <UserShiftCard userShift={userShift} onSelectUser={onSelectUser} />
            </motion.div>
          )}

          {/* COLLEAGUES SECOND */}
          {shifts.map((shift) => (
            <motion.div key={shift.id || `${shift.name}-${shift.start}`} variants={itemVariants} initial="hidden" animate="show" exit="exit" layout>
              {shift.start === '--:--' ? (
                <UnassignedShiftCard shift={shift} />
              ) : (
                <AssignedShiftCard shift={shift} onSelectUser={onSelectUser} />
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
function UserShiftCard({ userShift, onSelectUser }: { userShift: NonNullable<ShiftCardsProps['userShift']>; onSelectUser?: (userId: string) => void }) {
  const isChange = !!userShift.isChangeLocation;
  const clickable = !!(onSelectUser && userShift.userId);

  // Emerald/Green if standard, Yellow/Amber if location changed.
  const bg = isChange
    ? 'bg-linear-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30 border-yellow-200 dark:border-yellow-500/20'
    : 'bg-linear-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 border-emerald-200 dark:border-emerald-500/20';

  const box = isChange
    ? 'bg-yellow-500 text-white shadow-md'
    : 'bg-emerald-500 text-white shadow-md';

  const label = isChange
    ? 'text-yellow-700 dark:text-yellow-400'
    : 'text-emerald-700 dark:text-emerald-400';

  return (
    <div
      onClick={clickable ? () => onSelectUser!(userShift.userId!) : undefined}
      className={`flex flex-row gap-3 md:gap-4 rounded-xl p-1.5 shadow-sm items-center transition-all border backdrop-blur-sm ${bg} ${clickable ? 'cursor-pointer hover:brightness-[0.98] active:scale-[0.99]' : ''}`}
    >
      <div className={`flex items-center justify-center shrink-0 rounded-lg w-12 h-10 md:h-11 ${box}`}>
        <span className="text-metric-sm">{userShift.start ?? '--:--'}</span>
      </div>

      <div className="flex flex-1 items-center justify-between min-w-0">
        <div className="flex flex-col min-w-0">
          <p className={`text-micro mb-0.5 ${label}`}>Your shift</p>
          <p className="truncate text-body-strong text-gray-900 dark:text-white leading-tight">{userShift.name}</p>
        </div>

        <div className={`shrink-0 ml-2 rounded-full px-2.5 py-1 text-micro shadow-xs ${getRoleBadgeColor(userShift.role)}`}>
          {userShift.role}
        </div>
      </div>
    </div>
  );
}

/**
 * UI for a COLLEAGUE'S shift card.
 */
function AssignedShiftCard({ shift, onSelectUser }: { shift: ShiftDisplayData; onSelectUser?: (userId: string) => void }) {
  const isChange = !!shift.isChangeLocation;
  const clickable = !!(onSelectUser && shift.userId);

  // Colleagues are ALWAYS standard (white/gray) to avoid confusion with the user.
  const bg = 'bg-white/80 dark:bg-white/5 border-white dark:border-white/5';
  const box = 'bg-linear-to-br from-gray-400 to-gray-500 dark:from-gray-700 dark:to-gray-800';
  const nameLabel = 'text-gray-800 dark:text-white';

  return (
    <div
      onClick={clickable ? () => onSelectUser!(shift.userId!) : undefined}
      className={`flex flex-row gap-3 md:gap-4 rounded-xl p-1.5 shadow-sm items-center backdrop-blur-sm transition-all border ${bg} ${clickable ? 'cursor-pointer hover:brightness-[0.98] active:scale-[0.99]' : ''}`}
    >
      <div className={`flex items-center justify-center shrink-0 rounded-lg w-12 h-10 md:h-11 text-white shadow-xs ${box}`}>
        <span className="text-metric-sm">{shift.start ?? '--:--'}</span>
      </div>

      <div className="flex flex-1 items-center justify-between min-w-0">
        <div className="flex flex-col min-w-0">
          {shift.previousLocationName && (
            <div className="flex items-center flex-wrap gap-1 text-micro text-amber-600 dark:text-amber-500 mb-0.5">
              <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M11 17l-5-5 5-5" />
              </svg>
              <span>{shift.previousLocationName}</span>
            </div>
          )}
          {!shift.previousLocationName && isChange && (
            <span className="text-micro text-emerald-600 dark:text-emerald-400 mb-0.5">Moved</span>
          )}
          <p className={`truncate text-body-strong leading-tight ${nameLabel}`}>{shift.name}</p>
        </div>

        <div className={`shrink-0 ml-2 rounded-full px-2.5 py-1 text-micro shadow-xs ${getRoleBadgeColor(shift.role)}`}>
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
        <p className="flex-1 truncate text-title text-gray-900 dark:text-white">{shift.name}</p>
        <span className={`rounded-full px-2.5 py-1 text-micro ${getRoleBadgeColor(shift.role)}`}>
          {shift.role}
        </span>
      </div>
    </div>
  );
}
