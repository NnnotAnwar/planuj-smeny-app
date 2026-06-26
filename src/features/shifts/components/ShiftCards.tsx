import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { ArrowBendUpLeftIcon } from '@phosphor-icons/react';
import { type ShiftDisplayData } from '@shared/types';
import { getRoleBadgeColor } from '@/shared/utils/roleColors';

/**
 * --- SHIFT CARDS COMPONENT ---
 * Displays a list of shifts for a specific location.
 * Shows your own shift at the top if you're there.
 *
 * Colour language:
 *  - Your own active shift is always tinted in the app accent (the themeable
 *    `emerald-*` utilities), so it re-tints with the chosen colour scheme.
 *  - A location change ("moved") is flagged with a fixed amber accent — a left
 *    stripe + a "Moved from …" chip — rather than recolouring the whole card.
 *    Amber stays meaningful and distinct in every theme without fighting the
 *    accent hue.
 */

interface ShiftCardsProps {
  locationName: string;
  shifts: ShiftDisplayData[]; // Other workers.
  userShift?: ShiftDisplayData; // Your own shift.
  onSelectUser?: (userId: string) => void; // Open a worker's profile modal.
}

// Amber left stripe applied to any card representing a just-moved shift.
const MOVED_STRIPE = 'border-l-4 border-l-amber-400 dark:border-l-amber-500';

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -20, height: 0, marginTop: 0 },
  show: { opacity: 1, x: 0, height: 'auto', marginTop: 8 },
  exit: { opacity: 0, x: 20, height: 0, marginTop: 0 },
};

/** "↪ Moved from X" chip — the single, consistent location-change indicator. */
function MovedFrom({ from }: { from?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-micro font-bold text-amber-600 dark:text-amber-400 mb-0.5 normal-case tracking-normal">
      <ArrowBendUpLeftIcon weight="bold" className="w-3 h-3 shrink-0" />
      <span className="truncate">{from ? `Moved from ${from}` : 'Moved'}</span>
    </span>
  );
}

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
        display: hasContent ? 'block' : 'none',
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
 * UI for YOUR OWN active shift card — always accent-tinted; a move adds the amber
 * stripe + chip instead of recolouring the whole card.
 */
function UserShiftCard({ userShift, onSelectUser }: { userShift: NonNullable<ShiftCardsProps['userShift']>; onSelectUser?: (userId: string) => void }) {
  const isChange = !!userShift.isChangeLocation;
  const clickable = !!(onSelectUser && userShift.userId);

  return (
    <div
      onClick={clickable ? () => onSelectUser!(userShift.userId!) : undefined}
      className={`flex flex-row gap-3 md:gap-4 rounded-xl p-1.5 shadow-sm items-center transition-all border backdrop-blur-sm bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-500/20 ${isChange ? MOVED_STRIPE : ''} ${clickable ? 'cursor-pointer hover:brightness-[0.98] active:scale-[0.99]' : ''}`}
    >
      <div className="flex items-center justify-center shrink-0 rounded-lg w-12 h-10 md:h-11 bg-emerald-600 text-white shadow-md">
        <span className="text-metric-sm">{userShift.start ?? '--:--'}</span>
      </div>

      <div className="flex flex-1 items-center justify-between min-w-0">
        <div className="flex flex-col min-w-0">
          {isChange ? (
            <MovedFrom from={userShift.previousLocationName} />
          ) : (
            <p className="text-micro mb-0.5 text-emerald-700 dark:text-emerald-400">Your shift</p>
          )}
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
 * UI for a COLLEAGUE'S shift card — neutral surface (never accent, to avoid being
 * mistaken for your own), with the same amber move indicator.
 */
function AssignedShiftCard({ shift, onSelectUser }: { shift: ShiftDisplayData; onSelectUser?: (userId: string) => void }) {
  const isChange = !!(shift.isChangeLocation || shift.previousLocationName);
  const clickable = !!(onSelectUser && shift.userId);

  return (
    <div
      onClick={clickable ? () => onSelectUser!(shift.userId!) : undefined}
      className={`flex flex-row gap-3 md:gap-4 rounded-xl p-1.5 shadow-sm items-center backdrop-blur-sm transition-all border bg-white/80 dark:bg-white/5 border-white dark:border-white/5 ${isChange ? MOVED_STRIPE : ''} ${clickable ? 'cursor-pointer hover:brightness-[0.98] active:scale-[0.99]' : ''}`}
    >
      <div className="flex items-center justify-center shrink-0 rounded-lg w-12 h-10 md:h-11 text-white shadow-xs bg-linear-to-br from-gray-400 to-gray-500 dark:from-gray-700 dark:to-gray-800">
        <span className="text-metric-sm">{shift.start ?? '--:--'}</span>
      </div>

      <div className="flex flex-1 items-center justify-between min-w-0">
        <div className="flex flex-col min-w-0">
          {isChange && <MovedFrom from={shift.previousLocationName} />}
          <p className="truncate text-body-strong leading-tight text-gray-800 dark:text-white">{shift.name}</p>
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
