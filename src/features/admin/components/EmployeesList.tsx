import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Profile, User } from '@/shared/types';
import { getRoleBadgeColor } from '@/shared/utils/roleColors';
import { getFullInitials } from '@/shared/utils/getInitials';
import { canManageMember, RANK } from '../permissions';
import { ActionButtons } from './ActionButtons';
import { LoadingState, EmptyState } from './AdminStateViews';

/** Small "A" badge with a tap/hover "Administrator" tooltip. */
function AdminBadgeWithTooltip() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => setIsVisible(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    return (
        <div className="relative flex items-center shrink-0">
            <button
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onClick={(e) => {
                    e.stopPropagation();
                    setIsVisible(!isVisible);
                }}
                className="shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded bg-amber-400/10 border border-amber-500/20 flex items-center justify-center cursor-help transition-colors hover:bg-amber-500/20"
            >
                <span className="text-[8px] sm:text-[10px] font-black text-amber-600 dark:text-amber-400 leading-none">A</span>
            </button>

            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: -2 }}
                        exit={{ opacity: 0, scale: 0.8, y: 5 }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[8px] font-black uppercase tracking-widest rounded-md shadow-xl z-50 whitespace-nowrap pointer-events-none"
                    >
                        Administrator
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-gray-900 dark:border-t-white" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function EmployeesList({
    items,
    isLoading,
    currentUser,
    onEdit,
    onDelete,
}: {
    items: Profile[];
    isLoading: boolean;
    currentUser: User | null;
    onEdit: (emp: Profile) => void;
    onDelete: (emp: Profile) => void;
}) {
    if (isLoading) return <LoadingState label="employees" />;
    if (items.length === 0) return <EmptyState label="employees" />;

    return (
        <div className="grid gap-2">
            {items.map((employee) => {
                const isSelf = employee.id === currentUser?.id;
                const manageable = currentUser ? canManageMember(currentUser, employee) : false;
                return (
                    <div
                        key={employee.id}
                        className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"
                    >
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border-2 border-white dark:border-white/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-[10px] font-black shrink-0">
                            {getFullInitials(employee.first_name, employee.last_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <h3 className="font-bold text-xs sm:text-sm dark:text-white truncate leading-tight">
                                    {employee.first_name} {employee.last_name}
                                </h3>
                                {employee.role.rank >= RANK.ADMIN && <AdminBadgeWithTooltip />}
                                {isSelf && (
                                    <span className="shrink-0 px-1.5 py-0.5 text-[7px] sm:text-[8px] font-black rounded uppercase tracking-widest bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                                        You
                                    </span>
                                )}
                            </div>
                            <p className="text-[9px] sm:text-[10px] text-emerald-600 dark:text-emerald-400 font-bold truncate leading-tight">
                                @{employee.username}
                            </p>
                            <p className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-tight truncate">
                                {employee.email}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                            <span
                                className={`px-1.5 py-0.5 sm:px-2 sm:py-1 text-[7px] sm:text-[8px] font-black rounded-md uppercase tracking-widest ${getRoleBadgeColor(
                                    employee.role.name,
                                )}`}
                            >
                                {employee.role.name}
                            </span>
                            {/* Only members ranked below you can be edited or removed (never yourself). */}
                            {manageable && (
                                <ActionButtons onEdit={() => onEdit(employee)} onDelete={() => onDelete(employee)} />
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
