import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Profile, User } from '@/shared/types';
import { getRoleBadgeColor } from '@/shared/utils/roleColors';
import { getFullInitials } from '@/shared/utils/getInitials';
import { DataTable, type Column } from '@/shared/components/DataTable';
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
                className="shrink-0 w-4 h-4 rounded bg-amber-400/10 border border-amber-500/20 flex items-center justify-center cursor-help transition-colors hover:bg-amber-500/20"
            >
                <span className="text-micro text-amber-600 dark:text-amber-400">A</span>
            </button>

            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: -2 }}
                        exit={{ opacity: 0, scale: 0.8, y: 5 }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-micro rounded-md shadow-xl z-50 whitespace-nowrap pointer-events-none"
                    >
                        Administrator
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-gray-900 dark:border-t-white" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function RoleBadge({ role }: { role: Profile['role'] }) {
    return (
        <span className={`inline-block px-1.5 py-1 text-micro tracking-tight rounded-md whitespace-nowrap ${getRoleBadgeColor(role.name)}`}>{role.name}</span>
    );
}

export type EmployeeRow = Profile & { organizationName?: string };

function EmployeeIdentity({ employee, isSelf, org }: { employee: Profile; isSelf: boolean; org?: string }) {
    return (
        <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border-2 border-white dark:border-white/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-micro shrink-0">
                {getFullInitials(employee.first_name, employee.last_name)}
            </div>
            <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                    <h3 className="text-body-strong dark:text-white truncate min-w-0">
                        {employee.first_name} {employee.last_name}
                    </h3>
                    {employee.role.rank >= RANK.ADMIN && <AdminBadgeWithTooltip />}
                    {isSelf && (
                        <span className="shrink-0 px-1.5 py-0.5 text-micro rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                            You
                        </span>
                    )}
                </div>
                <p className="text-micro text-emerald-600 dark:text-emerald-400 truncate normal-case">@{employee.username}</p>
                {/* Org has its own column on sm+; shown here only on mobile (superadmin). */}
                {org && <p className="sm:hidden text-micro text-gray-400 truncate mt-0.5">{org}</p>}
            </div>
        </div>
    );
}

export function EmployeesList({
    items,
    isLoading,
    currentUser,
    showOrganization = false,
    onView,
    onEdit,
    onDelete,
}: {
    items: EmployeeRow[];
    isLoading: boolean;
    currentUser: User | null;
    showOrganization?: boolean;
    onView: (emp: EmployeeRow) => void;
    onEdit: (emp: Profile) => void;
    onDelete: (emp: Profile) => void;
}) {
    const manageable = (emp: Profile) => (currentUser ? canManageMember(currentUser, emp) : false);
    // Read-only viewers (e.g. Manager) can't manage anyone — drop the actions
    // column entirely so the Role badge sits flush right instead of leaving an
    // empty gutter.
    const anyManageable = items.some(manageable);

    const columns: Column<EmployeeRow>[] = [
        { key: 'employee', header: 'Employee', render: (emp) => <EmployeeIdentity employee={emp} isSelf={emp.id === currentUser?.id} org={showOrganization ? emp.organizationName : undefined} /> },
        { key: 'email', header: 'Email', hideOnMobile: true, className: 'truncate', render: (emp) => <span className="text-body text-gray-500 dark:text-gray-400">{emp.email}</span> },
        ...(showOrganization
            ? [{ key: 'org', header: 'Organization', hideOnMobile: true, className: 'truncate', render: (emp: EmployeeRow) => <span className="text-body text-gray-500 dark:text-gray-400">{emp.organizationName ?? '—'}</span> }]
            : []),
        { key: 'role', header: 'Role', align: 'right', width: 'w-24 sm:w-32', render: (emp) => <RoleBadge role={emp.role} /> },
        ...(anyManageable
            ? [
                  {
                      key: 'actions',
                      header: '',
                      align: 'right' as const,
                      width: 'w-20 sm:w-28',
                      render: (emp: Profile) =>
                          manageable(emp) ? (
                              <div className="flex justify-end">
                                  <ActionButtons onEdit={() => onEdit(emp)} onDelete={() => onDelete(emp)} />
                              </div>
                          ) : null,
                  },
              ]
            : []),
    ];

    return (
        <DataTable
            rows={items}
            rowKey={(emp) => emp.id}
            columns={columns}
            isLoading={isLoading}
            loadingState={<LoadingState label="employees" />}
            emptyState={<EmptyState label="employees" />}
            onRowClick={onView}
        />
    );
}
