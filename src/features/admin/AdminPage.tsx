import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BuildingsIcon,
    MapPinIcon,
    UsersIcon,
    PlusIcon,
    PaperPlaneTiltIcon,
    MagnifyingGlassIcon,
} from '@phosphor-icons/react';
import type { Organization, Profile } from '@/shared/types';

import { useAuthContext } from '@/features/auth/AuthContext';
import { AdminProvider, useAdminContext } from './AdminContext';
import { canManageEmployees, canManageLocations } from './permissions';
import { ConfirmDialog } from './components/Modal';
import { OrganizationForm } from './components/OrganizationForm';
import { LocationForm, type LocationEditTarget } from './components/LocationForm';
import { EmployeeForm } from './components/EmployeeForm';
import { InviteEmployeeForm } from './components/InviteEmployeeForm';
import { StatCard, ErrorState } from './components/AdminStateViews';
import { OrganizationsList } from './components/OrganizationsList';
import { LocationsList, type LocationRow } from './components/LocationsList';
import { EmployeesList } from './components/EmployeesList';

type TabType = 'employees' | 'locations' | 'organizations';

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
 * Entry point: provides admin state to the panel below it. The presentational
 * pieces (lists, stat cards, state views, action buttons) live in ./components.
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
                        <p className="text-label text-emerald-500">
                            System Infrastructure
                        </p>
                        <h1 className="text-display text-gray-900 dark:text-white sm:text-3xl">
                            Admin Panel
                        </h1>
                        <p className="text-small text-gray-400">
                            {isSuperAdmin ? 'Full system access' : 'Managing your organization'}
                        </p>
                    </div>

                    {canAdd && (
                        <button
                            onClick={handleAdd}
                            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-small-strong transition-all active:scale-95 shadow-lg shadow-emerald-500/25"
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
                                className={`relative flex items-center justify-center gap-2 flex-1 md:flex-none px-4 py-2 rounded-xl text-micro transition-all z-10 h-9 ${
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
                        className="w-full bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 focus:border-emerald-500/50 rounded-xl py-2 pl-9 pr-4 text-micro outline-none transition-all dark:text-white"
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
