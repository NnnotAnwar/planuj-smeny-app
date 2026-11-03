import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { ArrowBendUpLeftIcon, UsersIcon, ClockCountdownIcon } from '@phosphor-icons/react';
import { type ShiftDisplayData } from '@shared/types';
import { getRoleBadgeColor } from '@/shared/utils/roleColors';
import { useTranslation } from '@shared/preferences/PreferencesContext';

/**
 * --- SHIFT CARDS COMPONENT ---
 * Displays a list of shifts for a specific location.
 * Shows your own shift at the top if you're there.
 *
 * Colour language:
 *  - Your own active shift is always tinted in the app accent (the themeable
 *    `emerald-*` utilities), so it re-tints with the chosen colour scheme.
 *  - A location change ("moved") is flagged in a neutral monochrome — a left
 *    stripe + a "Moved from …" chip in black (light) / white (dark) — rather than
 *    recolouring the whole card. Staying monochrome keeps it readable in every
 *    theme without adding yet another hue to the palette.
 */

interface ShiftCardsProps {
  locationName: string;
  shifts: ShiftDisplayData[]; // Other workers.
  userShift?: ShiftDisplayData; // Your own shift.
  onSelectUser?: (userId: string) => void; // Open a worker's profile modal.
}

// Neutral (black / white) left stripe marking a just-moved shift.
const MOVED_STRIPE = 'border-l-4 border-l-gray-900 dark:border-l-white';

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -20, height: 0, marginTop: 0 },
  show: { opacity: 1, x: 0, height: 'auto', marginTop: 6 },
  exit: { opacity: 0, x: 20, height: 0, marginTop: 0 },
};

/** "↪ Moved from X" chip — the single, consistent location-change indicator. */
function MovedFrom({ from }: { from?: string }) {
  const t = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 text-micro font-bold text-ink dark:text-white normal-case tracking-normal">
      <ArrowBendUpLeftIcon weight="bold" className="size-3 shrink-0" />
      <span className="truncate">{from ? t('shifts.movedFrom', { location: from }) : t('shifts.moved')}</span>
    </span>
  );
}

export function ShiftCards({ locationName, shifts, userShift, onSelectUser }: ShiftCardsProps) {
  const t = useTranslation();
  const count = shifts.length + (userShift ? 1 : 0);
  const hasContent = count > 0;

  return (
    <motion.div
      layout
      initial={false}
      animate={{
        opacity: hasContent ? 1 : 0,
        height: hasContent ? 'auto' : 0,
        display: hasContent ? 'block' : 'none',
      }}
      className="glass overflow-hidden rounded-2xl p-1.5"
    >
      {/* Dark slate header — the location, and how many people are on shift there. */}
      <h3 className="flex items-center justify-between gap-3 rounded-xl bg-slate-ink px-3 py-2 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] dark:bg-white/8">
        <span className="truncate font-display text-sm font-bold tracking-[-0.01em]">{locationName}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-caption font-medium text-white/60">
          <UsersIcon weight="bold" className="size-3.5" />
          {t('home.onShiftCount', { n: count })}
        </span>
      </h3>

      <motion.div layout className="flex flex-col">
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

/** Start-time chip shared by every row; the accent fill marks your own shift. */
function TimeChip({ time, own }: { time?: string; own: boolean }) {
  return (
    <div
      className={`flex h-9 min-w-12 shrink-0 items-center justify-center rounded-lg px-1.5 text-white ${
        own ? 'bg-emerald-500 shadow-md shadow-emerald-500/25' : 'bg-slate-ink/85 dark:bg-white/10'
      }`}
    >
      <span className="text-metric-sm whitespace-nowrap">{time ?? '--:--'}</span>
    </div>
  );
}

/**
 * UI for YOUR OWN active shift card — always accent-tinted; a move adds the
 * monochrome stripe + chip instead of recolouring the whole card.
 */
function UserShiftCard({ userShift, onSelectUser }: { userShift: NonNullable<ShiftCardsProps['userShift']>; onSelectUser?: (userId: string) => void }) {
  const t = useTranslation();
  const isChange = !!userShift.isChangeLocation;
  const clickable = !!(onSelectUser && userShift.userId);

  return (
    <div
      onClick={clickable ? () => onSelectUser!(userShift.userId!) : undefined}
      className={`flex items-center gap-2.5 rounded-xl bg-white/85 p-1.5 ring-1 ring-emerald-500/20 transition-all dark:bg-white/8 dark:ring-emerald-400/20 ${isChange ? MOVED_STRIPE : ''} ${clickable ? 'cursor-pointer hover:bg-white active:scale-[0.99] dark:hover:bg-white/12' : ''}`}
    >
      <TimeChip time={userShift.start} own />

      <div className="flex min-w-0 flex-1 items-center justify-between">
        <div className="flex min-w-0 flex-col">
          {isChange ? (
            <MovedFrom from={userShift.previousLocationName} />
          ) : (
            <p className="text-eyebrow text-emerald-600 dark:text-emerald-300">{t('shifts.yourShift')}</p>
          )}
          <p className="mt-0.5 truncate text-sm font-semibold leading-tight text-ink dark:text-white">{userShift.name}</p>
        </div>

        <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-micro ${getRoleBadgeColor(userShift.role)}`}>
          {userShift.role}
        </span>
      </div>
    </div>
  );
}

/**
 * UI for a COLLEAGUE'S shift card — neutral surface (never accent, to avoid being
 * mistaken for your own), with the same monochrome move indicator.
 */
function AssignedShiftCard({ shift, onSelectUser }: { shift: ShiftDisplayData; onSelectUser?: (userId: string) => void }) {
  const isChange = !!(shift.isChangeLocation || shift.previousLocationName);
  const clickable = !!(onSelectUser && shift.userId);

  return (
    <div
      onClick={clickable ? () => onSelectUser!(shift.userId!) : undefined}
      className={`flex items-center gap-2.5 rounded-xl bg-white/55 p-1.5 ring-1 ring-ink/5 transition-all dark:bg-white/4 dark:ring-white/6 ${isChange ? MOVED_STRIPE : ''} ${clickable ? 'cursor-pointer hover:bg-white/80 active:scale-[0.99] dark:hover:bg-white/8' : ''}`}
    >
      <TimeChip time={shift.start} own={false} />

      <div className="flex min-w-0 flex-1 items-center justify-between">
        <div className="flex min-w-0 flex-col">
          {isChange && <MovedFrom from={shift.previousLocationName} />}
          <p className="truncate text-sm font-semibold leading-tight text-ink dark:text-white">{shift.name}</p>
        </div>

        <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-micro ${getRoleBadgeColor(shift.role)}`}>
          {shift.role}
        </span>
      </div>
    </div>
  );
}

function UnassignedShiftCard({ shift }: { shift: ShiftDisplayData }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-amber-50/80 p-1.5 ring-1 ring-amber-500/20 dark:bg-amber-500/8">
      <div className="flex h-9 min-w-12 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300">
        <ClockCountdownIcon weight="bold" className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between">
        <p className="truncate text-sm font-semibold text-ink dark:text-white">{shift.name}</p>
        <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-micro ${getRoleBadgeColor(shift.role)}`}>
          {shift.role}
        </span>
      </div>
    </div>
  );
}
