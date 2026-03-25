import { useState, useEffect } from "react"
import { useAdmin } from "./hooks/useAdmin"
import { motion, AnimatePresence } from 'framer-motion';
import {
    BuildingsIcon,
    MapPinIcon,
    UsersIcon,
    PlusIcon,
    PencilSimpleIcon,
    TrashIcon,
    MagnifyingGlassIcon
} from '@phosphor-icons/react';
import type { Location, Organization, Profile } from "@/shared/types";
import { useAuthContext } from "../auth/AuthContext";
import { getRoleBadgeColor } from "@/shared/utils/roleColors";
import { getFullInitials } from "@/shared/utils/getInitials";


export function AdminPage() {
    const [activeTab, setActiveTab] = useState<TabType>('employees');
    const [searchQuery, setSearchQuery] = useState('');
    const { adminData } = useAdmin()
    const { user } = useAuthContext()
    const isSuperAdmin = user?.role.name === 'Superadmin'

    const locations = adminData?.flatMap(org => {
        return org.locations.map((loc) => ({
            ...loc,
            organizationName: org.name
        }))
    }) || null

    const employees = adminData?.flatMap(org => {
        return org.profiles
    }) || null

    type TabType = 'organizations' | 'locations' | 'employees';

    const tabs = [
        { id: 'employees', label: 'Employees', icon: UsersIcon },
        { id: 'locations', label: 'Locations', icon: MapPinIcon },
        ...(isSuperAdmin ? [{ id: 'organizations', label: 'Organizations', icon: BuildingsIcon }] : []),
    ] as const;


    return (
        <div className="space-y-6 px-1 max-w-7xl mx-auto w-full">

            {/* --- HEADER --- */}
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-0.5">
                    <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest">System Infrastructure</p>
                    <h1 className="text-gray-900 dark:text-white font-black text-2xl tracking-tight">Admin Panel</h1>
                </div>

                <button
                    onClick={() => alert(`Open Add Modal for ${activeTab}`)}
                    className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                >
                    <PlusIcon weight="bold" className="w-4 h-4" />
                    <span>Add New {activeTab.slice(0, -1)}</span>
                </button>
            </header>

            {/* --- TABS & SEARCH --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex bg-gray-100 dark:bg-gray-800/50 p-1 rounded-2xl w-full md:w-auto overflow-x-auto scrollbar-hide whitespace-nowrap">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`relative flex items-center justify-center gap-2 flex-1 md:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all z-10 h-9 ${isActive
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="admin-active-tab"
                                        className="absolute inset-0 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200/50 dark:border-white/5"
                                        initial={false}
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <tab.icon weight={isActive ? "fill" : "bold"} className="w-5 h-5 sm:w-4 sm:h-4 relative z-10" />
                                <span className="relative z-10 hidden sm:block">{tab.label}</span>
                            </button>
                        )
                    })}
                </div>

                <div className="relative w-full md:w-64">
                    <input
                        type="text"
                        placeholder={`Search ${activeTab}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 focus:border-emerald-500/50 rounded-xl py-2 pl-9 pr-4 text-[10px] font-bold uppercase tracking-wider outline-none transition-all dark:text-white"
                    />
                    <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                </div>
            </div>

            {/* --- CONTENT AREA --- */}
            <div className="mt-2">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-2"
                    >
                        {activeTab === 'organizations' && <OrganizationsList items={adminData} />}
                        {activeTab === 'locations' && <LocationsList items={locations} />}
                        {activeTab === 'employees' && <EmployeesList items={employees} />}
                    </motion.div>
                </AnimatePresence>
            </div>

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

function OrganizationsList({ items }: { items: Organization[] | null }) {
    return !items
        ? <div className="py-20 text-center text-gray-400 text-xs font-bold uppercase tracking-widest animate-pulse">Loading Organizations...</div>
        : (
            <div className="grid gap-2">
                {items.map((org) => (
                    <div key={org.id} className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
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
                            <ActionButtons />
                        </div>
                    </div>
                ))}
            </div>
        )
}

function LocationsList({ items }: { items: Location[] | null }) {
    return !items ? null : (
        <div className="grid gap-2">
            {items.map((loc) => (
                <div key={loc.id} className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
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
                        <ActionButtons />
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmployeesList({ items }: { items: Profile[] | null }) {
    return !items ? null : (
        <div className="grid gap-2">
            {items.map((employee) => (
                <div key={employee.id} className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border-2 border-white dark:border-white/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-[10px] font-black shrink-0">
                        {getFullInitials(employee.first_name, employee.last_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-xs sm:text-sm dark:text-white truncate leading-tight">
                                {employee.first_name} {employee.last_name}
                            </h3>
                            {employee.role.is_admin && <AdminBadgeWithTooltip />}
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-tight truncate">{employee.email}</p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <span className={`px-1.5 py-0.5 sm:px-2 sm:py-1 text-[7px] sm:text-[8px] font-black rounded-md uppercase tracking-widest ${getRoleBadgeColor(employee.role.name)}`}>
                            {employee.role.name}
                        </span>
                        <ActionButtons />
                    </div>
                </div>
            ))}
        </div>
    );
}

function ActionButtons() {
    return (
        <div className="flex items-center gap-0.5">
            <button
                onClick={() => alert('Edit clicked')}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
            >
                <PencilSimpleIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" weight="bold" />
            </button>
            <button
                onClick={() => alert('Delete clicked')}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
            >
                <TrashIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" weight="bold" />
            </button>
        </div>
    );
}
