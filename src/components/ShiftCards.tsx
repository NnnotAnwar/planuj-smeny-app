import { motion, AnimatePresence, type Variants } from 'framer-motion';
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

const containerVariants: Variants = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { 
    height: 0, 
    opacity: 0,
    marginTop: 0,
    overflow: 'hidden'
  },
  show: { 
    height: 'auto', 
    opacity: 1,
    marginTop: 8,
    transition: {
      height: { duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] },
      opacity: { duration: 0.3, delay: 0.1 }
    }
  },
  exit: { 
    height: 0, 
    opacity: 0,
    marginTop: 0,
    transition: { 
      height: { duration: 0.3 },
      opacity: { duration: 0.2 }
    } 
  },
};

export default function ShiftCards({ locationName, shifts, userShift }: ShiftCardsProps) {
  if (shifts.length === 0 && !userShift) return null;

  return (
    <div className="rounded-xl bg-gray-100/50 dark:bg-white/5 backdrop-blur-sm p-0 md:p-4 mb-4 border border-white/20 dark:border-white/5 transition-all">
      <h3 className="mb-2 flex items-center justify-between rounded-lg bg-gray-800 dark:bg-gray-800/90 px-3 py-1.5 text-sm font-semibold text-white border border-gray-700 dark:border-gray-600">
        <span>{locationName}</span>
      </h3>


      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-2" 
      >
        <AnimatePresence initial={false}>
          {userShift && (
            <motion.div 
              key="user-active-shift" 
              variants={itemVariants} 
              exit="exit"
              layout
            >
              <UserShiftCard userShift={userShift} />
            </motion.div>
          )}

          {shifts.map((shift) => (
            <motion.div 
              key={shift.id || `${shift.name}-${shift.start}`} 
              variants={itemVariants} 
              exit="exit"
              layout
            >
              {shift.start === null ? (
                <UnassignedShiftCard shift={shift} />
              ) : (
                <AssignedShiftCard shift={shift} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function UserShiftCard({ userShift }: { userShift: NonNullable<ShiftCardsProps['userShift']> }) {
  const isEmerald = !userShift.isChangeLocation;
  const bg = isEmerald 
    ? 'bg-linear-to-r from-emerald-50/80 to-teal-50/80 dark:from-emerald-900/30 dark:to-teal-900/30' 
    : 'bg-linear-to-r from-yellow-50/80 to-amber-50/80 dark:from-yellow-900/30 dark:to-amber-900/30';
  const box = isEmerald
    ? 'bg-emerald-500 text-white shadow-sm'
    : 'bg-yellow-500 text-white shadow-sm';
  const label = isEmerald 
    ? 'text-emerald-700 dark:text-emerald-300' 
    : 'text-yellow-700 dark:text-yellow-300';

  return (
    <div className={`flex flex-row gap-4 rounded-lg p-1.5 shadow-sm md:items-center transition-all border border-white/20 dark:border-white/5 backdrop-blur-sm ${bg}`}>
      <div className={`flex items-center justify-between rounded-lg px-2 py-1 ${box}`}>
        <div className="text-center">
          <span className="text-sm font-bold">{userShift.start ?? '--:--'}</span>
        </div>
      </div>
      <div className="flex w-full items-center">
        <div className="flex flex-1 items-center gap-3">
          <div>
            <p className={`text-[10px] font-bold ${label}`}>Your shift</p>
            <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{userShift.name}</p>
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
    <div className="flex flex-row gap-4 rounded-lg p-1.5 shadow-sm md:items-center bg-white/60 dark:bg-white/5 backdrop-blur-sm transition-all border border-white/20 dark:border-white/5">
      <div className="flex items-center justify-between rounded-lg bg-linear-to-br from-gray-400 to-gray-500 dark:from-gray-700 dark:to-gray-800 px-2 py-1 text-white">
        <div className="text-center">
          <span className="text-sm font-bold">{shift.start ?? '--:--'}</span>
        </div>
      </div>
      <div className="flex w-full items-center">
        <div className="flex flex-1 items-center gap-3">
          <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{shift.name}</p>
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
