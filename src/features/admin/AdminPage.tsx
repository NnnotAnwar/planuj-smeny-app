import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BuildingsIcon,
    MapPinIcon,
    UsersIcon,
    PlusIcon,
    PaperPlaneTiltIcon,
} from '@phosphor-icons/react';
import { SearchInput } from '@shared/components/SearchInput';
import { Button } from '@shared/components/Button';
import { PageHeader } from '@shared/components/PageHeader';
import type { Organization, Profile } from '@/shared/types';

import { useAuthContext } from '@/features/auth/AuthContext';
import { AdminProvider, useAdminContext } from './AdminContext';
import { canManageEmployees, canManageLocations } from '@shared/auth/permissions';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { ConfirmDialog } from './components/Modal';
import { OrganizationForm } from './components/OrganizationForm';
import { LocationForm, type LocationEditTarget } from './components/LocationForm';
import { EmployeeForm } from './components/EmployeeForm';
import { InviteEmployeeForm } from './components/InviteEmployeeForm';
import { StatCard, ErrorState } from './components/AdminStateViews';
import { OrganizationsList } from './components/OrganizationsList';
import { LocationsList, type LocationRow } from './components/LocationsList';
import { EmployeesList, type EmployeeRow } from './components/EmployeesList';
import { EmployeeProfileModal } from '@features/profile/components/EmployeeProfileModal';

type TabType = 'employees' | 'locations' | 'organizations';

type ModalState =
    | { kind: 'org-form'; org?: Organization }
    | { kind: 'loc-form'; loc?: LocationEditTarget }
    | { kind: 'emp-form'; emp: Profile }
    | { kind: 'emp-profile'; emp: EmployeeRow }
    | { kind: 'invite-emp' }
    | { kind: 'delete'; entity: TabType; id: string; label: string }
    | null;

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
    const t = useTranslation();

    // Admin (rank >= 30) capability.
    const canManageEmp = user ? canManageEmployees(user) : false;
    const canManageLoc = user ? canManageLocations(user) : false;

    // `?tab=locations` (e.g. from the Home setup checklist) opens that tab.
    const [params] = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabType>(() => {
        const q = params.get('tab');
        return q === 'locations' || q === 'organizations' ? q : 'employees';
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [modal, setModal] = useState<ModalState>(null);

    const tabs = [
        { id: 'employees', label: t('admin.tabEmployees'), icon: UsersIcon },
        { id: 'locations', label: t('admin.tabLocations'), icon: MapPinIcon },
        ...(isSuperAdmin ? [{ id: 'organizations', label: t('admin.tabOrganizations'), icon: BuildingsIcon }] : []),
    ] as const;

    // Guard against showing a tab the user may not access (e.g. if their role
    // changes mid-session) without a setState-in-effect round trip.
    const safeTab: TabType =
        activeTab === 'organizations' && !isSuperAdmin ? 'employees' : activeTab;

    // --- Derived, flattened + searched collections ---
    const query = searchQuery.trim().toLowerCase();

    const locations = useMemo<LocationRow[]>(() => {
        const all =
            adminData?.flatMap((org) =>
                org.locations
                    .filter((loc) => !loc.archived_at) // archived locations are hidden
                    .map((loc) => ({
                        id: loc.id,
                        name: loc.name,
                        code: loc.code ?? null,
                        organization_id: loc.organization_id,
                        organizationName: org.name,
                    })),
            ) ?? [];
        if (!query) return all;
        return all.filter((l) => `${l.name} ${l.organizationName}`.toLowerCase().includes(query));
    }, [adminData, query]);

    const employees = useMemo<EmployeeRow[]>(() => {
        const all =
            adminData?.flatMap((org) =>
                org.profiles.map((p) => ({ ...p, organizationName: org.name })),
            ) ?? [];
        if (!query) return all;
        return all.filter((e) =>
            `${e.first_name ?? ''} ${e.last_name ?? ''} ${e.email} ${e.username} ${e.role.name} ${e.organizationName}`
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
    const locCount = adminData?.reduce((n, o) => n + o.locations.filter((l) => !l.archived_at).length, 0) ?? 0;
    const empCount = adminData?.reduce((n, o) => n + o.profiles.length, 0) ?? 0;

    // Capability flags drive what the current user can do (mirrors RLS).
    const canAdd =
        safeTab === 'employees'
            ? canManageEmp
            : safeTab === 'locations'
                ? canManageLoc
                : safeTab === 'organizations'
                    ? isSuperAdmin
                    : false;

    return (
        <div className="space-y-4 px-1 pb-10">
            {/* --- HEADER --- */}
            <PageHeader
                eyebrow={t('admin.systemInfra')}
                title={t('nav.team')}
                description={isSuperAdmin ? t('admin.fullAccess') : t('admin.managingOrg')}
                actions={
                    canAdd && (
                        <Button
                            size="sm"
                            icon={safeTab === 'employees' ? PaperPlaneTiltIcon : PlusIcon}
                            onClick={handleAdd}
                        >
                            {safeTab === 'employees' ? t('admin.inviteEmployee') : safeTab === 'locations' ? t('admin.addLocation') : t('admin.addOrganization')}
                        </Button>
                    )
                }
            />

            {/* --- STATS --- */}
            <div className={`grid gap-2 sm:gap-3 ${isSuperAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <StatCard icon={UsersIcon} label={t('admin.tabEmployees')} value={empCount} accent="emerald" />
                <StatCard icon={MapPinIcon} label={t('admin.tabLocations')} value={locCount} accent="blue" />
                {isSuperAdmin && <StatCard icon={BuildingsIcon} label={t('admin.tabOrganizations')} value={orgCount} accent="violet" />}
            </div>

            {/* --- TABS & SEARCH --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="segmented w-full md:w-auto overflow-x-auto scrollbar-hide whitespace-nowrap">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`relative flex items-center justify-center gap-1.5 flex-1 md:flex-none px-3 rounded-[9px] text-meta font-semibold transition-all z-10 h-8 ${isActive
                                        ? 'text-ink dark:text-white'
                                        : 'text-ink-soft hover:text-ink dark:text-slate-400 dark:hover:text-white'
                                    }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="admin-active-tab"
                                        className="segment-active absolute inset-0 rounded-[9px]"
                                        initial={false}
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <tab.icon weight={isActive ? 'fill' : 'bold'} className={`size-4 relative z-10 ${isActive ? 'text-emerald-600 dark:text-emerald-300' : ''}`} />
                                <span className="relative z-10 hidden sm:block">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder={t('admin.search', { what: safeTab === 'employees' ? t('admin.nounEmployees') : safeTab === 'locations' ? t('admin.nounLocations') : t('admin.nounOrganizations') })}
                    className="w-full md:w-64"
                />
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
                                    showOrganization={isSuperAdmin}
                                    onView={(emp) => setModal({ kind: 'emp-profile', emp })}
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
                {modal?.kind === 'emp-profile' && (
                    <EmployeeProfileModal
                        employee={modal.emp}
                        organizationName={modal.emp.organizationName}
                        showOrganization={isSuperAdmin}
                        isSelf={modal.emp.id === user?.id}
                        onClose={() => setModal(null)}
                    />
                )}
                {modal?.kind === 'invite-emp' && <InviteEmployeeForm onClose={() => setModal(null)} />}
                {modal?.kind === 'delete' && (
                    <ConfirmDialog
                        title={t('admin.confirmDeletionTitle')}
                        message={t('admin.confirmDeletionMessage', { label: modal.label })}
                        onConfirm={confirmDelete}
                        onClose={() => setModal(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
