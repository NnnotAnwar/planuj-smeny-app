import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BuildingsIcon,
    MapPinIcon,
    UsersIcon,
    PlusIcon,
    PaperPlaneTiltIcon,
    PencilSimpleIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    type Icon,
} from '@phosphor-icons/react';
import type { Organization, Profile, User } from '@/shared/types';
import { getRoleBadgeColor } from '@/shared/utils/roleColors';
import { getFullInitials } from '@/shared/utils/getInitials';

import { useAuthContext } from '@/features/auth/AuthContext';
import { AdminProvider, useAdminContext } from './AdminContext';
import { canManageEmployees, canManageLocations, canManageMember, RANK } from './permissions';
import { ConfirmDialog } from './components/Modal';
import { OrganizationForm } from './components/OrganizationForm';
import { LocationForm, type LocationEditTarget } from './components/LocationForm';
import { EmployeeForm } from './components/EmployeeForm';
import { InviteEmployeeForm } from './components/InviteEmployeeForm';

type TabType = 'employees' | 'locations' | 'organizations';

interface LocationRow {
    id: string;
    name: string;
    organization_id: string;
    organizationName: string;
}

type ModalState =
    | { kind: 'org-form'; org?: Organization }
    | { kind: 'loc-form'; loc?: LocationEditTarget }
    | { kind: 'emp-form'; emp: Profile }
    | { kind: 'invite-emp' }
    | { kind: 'delete'; entity: TabType; id: string; label: string }
    | null;

const ADD_LABEL: Record<TabType, string> = {
    organizations: 'Add Organization',
    locations: 'Add Location',
    employees: 'Invite Employee',
};

/**
 * --- ADMIN PAGE ---
 * Entry point: provides admin state to the panel below it.
 */
export function AdminPage() {
    return (
        <AdminProvider>
            <AdminPanel />
        </AdminProvider>
    );
}

function AdminPanel() {
    const {
        adminData,
        isLoading,
        error,
        isSuperAdmin,
        deleteOrganization,
        deleteLocation,
        deleteEmployee,
    } = useAdminContext();
    const { user } = useAuthContext();

    const [activeTab, setActiveTab] = useState<TabType>('employees');
    const [searchQuery, setSearchQuery] = useState('');
    const [modal, setModal] = useState<ModalState>(null);

    const tabs = [
        { id: 'employees', label: 'Employees', icon: UsersIcon },
        { id: 'locations', label: 'Locations', icon: MapPinIcon },
        ...(isSuperAdmin ? [{ id: 'organizations', label: 'Organizations', icon: BuildingsIcon }] : []),
    ] as const;

    // Guard against showing the Organizations tab to a non-Superadmin (e.g. if
    // their role changes mid-session) without a setState-in-effect round trip.
    const safeTab: TabType = activeTab === 'organizations' && !isSuperAdmin ? 'employees' : activeTab;

    // --- Derived, flattened + searched collections ---
    const query = searchQuery.trim().toLowerCase();

    const locations = useMemo<LocationRow[]>(() => {
        const all =
            adminData?.flatMap((org) =>
                org.locations.map((loc) => ({
                    id: loc.id,
                    name: loc.name,
                    organization_id: loc.organization_id,
                    organizationName: org.name,
                })),
            ) ?? [];
        if (!query) return all;
        return all.filter((l) => `${l.name} ${l.organizationName}`.toLowerCase().includes(query));
    }, [adminData, query]);

    const employees = useMemo<Profile[]>(() => {
        const all = adminData?.flatMap((org) => org.profiles) ?? [];
        if (!query) return all;
        return all.filter((e) =>
            `${e.first_name ?? ''} ${e.last_name ?? ''} ${e.email} ${e.username} ${e.role.name}`
                .toLowerCase()
                .includes(query),
        );
    }, [adminData, query]);

    const organizations = useMemo<Organization[]>(() => {
        const all = adminData ?? [];
        if (!query) return all;
        return all.filter((o) => `${o.name} ${o.slug ?? ''}`.toLowerCase().includes(query));
    }, [adminData, query]);

    const handleAdd = () => {
        if (safeTab === 'organizations') setModal({ kind: 'org-form' });
        else if (safeTab === 'locations') setModal({ kind: 'loc-form' });
        else setModal({ kind: 'invite-emp' });
    };

    const confirmDelete = async () => {
        if (modal?.kind !== 'delete') return;
        if (modal.entity === 'organizations') await deleteOrganization(modal.id);
        else if (modal.entity === 'locations') await deleteLocation(modal.id);
        else await deleteEmployee(modal.id);
    };

    const orgCount = adminData?.length ?? 0;
    const locCount = adminData?.reduce((n, o) => n + o.locations.length, 0) ?? 0;
    const empCount = adminData?.reduce((n, o) => n + o.profiles.length, 0) ?? 0;

    // Capability flags drive what the current user can do (mirrors RLS).
    const canManageEmp = user ? canManageEmployees(user) : false;
    const canManageLoc = user ? canManageLocations(user) : false;
    const canAdd =
        safeTab === 'employees' ? canManageEmp : safeTab === 'locations' ? canManageLoc : isSuperAdmin;

    return (
        <div className="space-y-6 px-1 max-w-7xl mx-auto w-full">
            {/* --- HEADER --- */}
            <header className="relative overflow-hidden rounded-3xl border border-emerald-100 dark:border-emerald-900/30 bg-gradient-to-br from-emerald-50 via-white to-white dark:from-emerald-950/40 dark:via-gray-900/40 dark:to-gray-900/40 p-5 sm:p-6">
                <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-emerald-400/10 blur-2xl" />
                <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest">
                            System Infrastructure
                        </p>
                        <h1 className="text-gray-900 dark:text-white font-black text-2xl sm:text-3xl tracking-tight">
                            Admin Panel
                        </h1>
                        <p className="text-xs font-medium text-gray-400">
                            {isSuperAdmin ? 'Full system access' : 'Managing your organization'}
                        </p>
                    </div>

                    {canAdd && (
                        <button
                            onClick={handleAdd}
                            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-lg shadow-emerald-500/25"
                        >
                            {safeTab === 'employees' ? (
                                <PaperPlaneTiltIcon weight="bold" className="w-4 h-4" />
                            ) : (
                                <PlusIcon weight="bold" className="w-4 h-4" />
                            )}
                            <span>{ADD_LABEL[safeTab]}</span>
                        </button>
                    )}
                </div>
            </header>

            {/* --- STATS --- */}
            <div className={`grid gap-3 ${isSuperAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <StatCard icon={UsersIcon} label="Employees" value={empCount} accent="emerald" />
                <StatCard icon={MapPinIcon} label="Locations" value={locCount} accent="blue" />
                {isSuperAdmin && <StatCard icon={BuildingsIcon} label="Organizations" value={orgCount} accent="violet" />}
            </div>

            {/* --- TABS & SEARCH --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex bg-gray-100 dark:bg-gray-800/50 p-1 rounded-2xl w-full md:w-auto overflow-x-auto scrollbar-hide whitespace-nowrap">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`relative flex items-center justify-center gap-2 flex-1 md:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all z-10 h-9 ${
                                    isActive
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="admin-active-tab"
                                        className="absolute inset-0 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200/50 dark:border-white/5"
                                        initial={false}
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <tab.icon weight={isActive ? 'fill' : 'bold'} className="w-5 h-5 sm:w-4 sm:h-4 relative z-10" />
                                <span className="relative z-10 hidden sm:block">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="relative w-full md:w-64">
                    <input
                        type="text"
                        placeholder={`Search ${safeTab}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 focus:border-emerald-500/50 rounded-xl py-2 pl-9 pr-4 text-[10px] font-bold uppercase tracking-wider outline-none transition-all dark:text-white"
                    />
                    <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                </div>
            </div>

            {/* --- CONTENT AREA --- */}
            <div className="mt-2">
                {error ? (
                    <ErrorState message={error} />
                ) : (
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={safeTab}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-2"
                        >
                            {safeTab === 'organizations' && (
                                <OrganizationsList
                                    items={organizations}
                                    isLoading={isLoading}
                                    onEdit={(org) => setModal({ kind: 'org-form', org })}
                                    onDelete={(org) =>
                                        setModal({ kind: 'delete', entity: 'organizations', id: org.id, label: org.name })
                                    }
                                />
                            )}
                            {safeTab === 'locations' && (
                                <LocationsList
                                    items={locations}
                                    isLoading={isLoading}
                                    canManage={canManageLoc}
                                    onEdit={(loc) => setModal({ kind: 'loc-form', loc })}
                                    onDelete={(loc) =>
                                        setModal({ kind: 'delete', entity: 'locations', id: loc.id, label: loc.name })
                                    }
                                />
                            )}
                            {safeTab === 'employees' && (
                                <EmployeesList
                                    items={employees}
                                    isLoading={isLoading}
                                    currentUser={user}
                                    onEdit={(emp) => setModal({ kind: 'emp-form', emp })}
                                    onDelete={(emp) =>
                                        setModal({
                                            kind: 'delete',
                                            entity: 'employees',
                                            id: emp.id,
                                            label: `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() || emp.username,
                                        })
                                    }
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>

            {/* --- MODALS --- */}
            <AnimatePresence>
                {modal?.kind === 'org-form' && <OrganizationForm org={modal.org} onClose={() => setModal(null)} />}
                {modal?.kind === 'loc-form' && <LocationForm location={modal.loc} onClose={() => setModal(null)} />}
                {modal?.kind === 'emp-form' && <EmployeeForm employee={modal.emp} onClose={() => setModal(null)} />}
                {modal?.kind === 'invite-emp' && <InviteEmployeeForm onClose={() => setModal(null)} />}
                {modal?.kind === 'delete' && (
                    <ConfirmDialog
                        title="Confirm Deletion"
                        message={`Delete "${modal.label}"? This action cannot be undone.`}
                        onConfirm={confirmDelete}
                        onClose={() => setModal(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ==========================================
// STATE HELPERS
// ==========================================

const STAT_ACCENTS: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
};

function StatCard({ icon: StatIcon, label, value, accent }: { icon: Icon; label: string; value: number; accent: string }) {
    return (
        <div className="flex items-center gap-3 p-3 sm:p-4 bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${STAT_ACCENTS[accent]}`}>
                <StatIcon className="w-5 h-5" weight="bold" />
            </div>
            <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-none">{value}</p>
                <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{label}</p>
            </div>
        </div>
    );
}

function LoadingState({ label }: { label: string }) {
    return (
        <div className="py-20 text-center text-gray-400 text-xs font-bold uppercase tracking-widest animate-pulse">
            Loading {label}…
        </div>
    );
}

function EmptyState({ label }: { label: string }) {
    return (
        <div className="py-20 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">No {label} found</div>
    );
}

function ErrorState({ message }: { message: string }) {
    return (
        <div className="py-16 text-center space-y-1">
            <p className="text-red-500 text-xs font-black uppercase tracking-widest">Something went wrong</p>
            <p className="text-gray-400 text-xs font-medium">{message}</p>
        </div>
    );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

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

function OrganizationsList({
    items,
    isLoading,
    onEdit,
    onDelete,
}: {
    items: Organization[];
    isLoading: boolean;
    onEdit: (org: Organization) => void;
    onDelete: (org: Organization) => void;
}) {
    if (isLoading) return <LoadingState label="organizations" />;
    if (items.length === 0) return <EmptyState label="organizations" />;

    return (
        <div className="grid gap-2">
            {items.map((org) => (
                <div
                    key={org.id}
                    className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"
                >
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center shrink-0">
                        <BuildingsIcon className="w-5 h-5" weight="bold" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm dark:text-white truncate">{org.name}</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{org.slug}</p>
                    </div>
                    <div className="flex items-center gap-6 pr-2">
                        <div className="hidden sm:flex gap-4">
                            <div className="text-center">
                                <p className="text-xs font-black dark:text-white">{org.locations.length}</p>
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Locs</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-black dark:text-white">{org.profiles.length}</p>
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Users</p>
                            </div>
                        </div>
                        <ActionButtons onEdit={() => onEdit(org)} onDelete={() => onDelete(org)} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function LocationsList({
    items,
    isLoading,
    canManage,
    onEdit,
    onDelete,
}: {
    items: LocationRow[];
    isLoading: boolean;
    canManage: boolean;
    onEdit: (loc: LocationRow) => void;
    onDelete: (loc: LocationRow) => void;
}) {
    if (isLoading) return <LoadingState label="locations" />;
    if (items.length === 0) return <EmptyState label="locations" />;

    return (
        <div className="grid gap-2">
            {items.map((loc) => (
                <div
                    key={loc.id}
                    className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"
                >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center shrink-0">
                        <MapPinIcon className="w-5 h-5" weight="bold" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm dark:text-white truncate">{loc.name}</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{loc.organizationName}</p>
                    </div>
                    <div className="flex items-center gap-4 pr-2">
                        <span className="hidden sm:inline-block px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 text-[8px] font-black rounded uppercase tracking-widest">
                            {loc.id.slice(0, 8)}
                        </span>
                        {canManage && <ActionButtons onEdit={() => onEdit(loc)} onDelete={() => onDelete(loc)} />}
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmployeesList({
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

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete?: () => void }) {
    return (
        <div className="flex items-center gap-0.5">
            <button
                onClick={onEdit}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                aria-label="Edit"
            >
                <PencilSimpleIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" weight="bold" />
            </button>
            {onDelete && (
                <button
                    onClick={onDelete}
                    className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    aria-label="Delete"
                >
                    <TrashIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" weight="bold" />
                </button>
            )}
        </div>
    );
}
