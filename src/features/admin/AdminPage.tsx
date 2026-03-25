import { useState } from "react"
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
import type { Location, Organization } from "@/shared/types";
import { useAuthContext } from "../auth/AuthContext";


export function AdminPage() {
    // const [organizationName, setOrganizationName] = useState('')
    // const [slug, setSlug] = useState('')
    const [activeTab, setActiveTab] = useState<TabType>('employees');
    const [searchQuery, setSearchQuery] = useState('');
    const { organizations, locations } = useAdmin()
    const { user } = useAuthContext()

    const isSuperAdmin = user?.role.name === 'Superadmin'

    type TabType = 'organizations' | 'locations' | 'employees';

    const tabs = [
        { id: 'employees', label: 'Employees', icon: UsersIcon },
        { id: 'locations', label: 'Locations', icon: MapPinIcon },
        ...(isSuperAdmin ? [{ id: 'organizations', label: 'Organizations', icon: BuildingsIcon }] : []),
    ] as const;

    // return (
    //         <div>
    //             {user?.role.name === "Superadmin" && (
    //                 <form className="mt-8 space-y-6" onSubmit={(e) => {
    //                     e.preventDefault()
    //                     handleCreateOrg(organizationName, slug)
    //                 }}>
    //                     <div className="space-y-4">
    //                         <div>
    //                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Organization Name</label>
    //                             <input
    //                                 type="text"
    //                                 required
    //                                 value={organizationName}
    //                                 onChange={(e) => setOrganizationName(e.target.value)}
    //                                 className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-800 dark:text-gray-100 sm:text-sm"
    //                                 placeholder="My Restaurant"
    //                             />
    //                         </div>
    //                         <div>
    //                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">slug</label>
    //                             <input
    //                                 type="text"
    //                                 required={false}
    //                                 value={slug}
    //                                 onChange={(e) => setSlug(e.target.value)}
    //                                 className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-800 dark:text-gray-100 sm:text-sm"
    //                                 placeholder="slug"
    //                             />
    //                         </div>
    //                     </div>



    //                     <button
    //                         type="submit"
    //                         className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
    //                     >
    //                         Create organization
    //                     </button>
    //                 </form>
    //             )}
    //         </div>

    //     )

    return (
        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">

            {/* --- HEADER --- */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                        Admin Panel
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Manage your entire system infrastructure from one place.
                    </p>
                </div>

                <button
                    onClick={() => alert(`Open Add Modal for ${activeTab}`)}
                    className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-emerald-500/30"
                >
                    <PlusIcon weight="bold" className="w-5 h-5" />
                    <span>Add New {activeTab.slice(0, -1)}</span>
                </button>
            </div>

            {/* --- TABS & SEARCH --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">

                {/* Переключатели */}
                <div className="flex bg-gray-100 dark:bg-gray-800/50 p-1 rounded-2xl w-full md:w-auto">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`relative flex items-center justify-center gap-2 flex-1 md:flex-none px-4 py-2.5 rounded-xl text-sm font-bold transition-colors z-10 ${isActive
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
                                <tab.icon weight={isActive ? "fill" : "regular"} className="w-5 h-5 relative z-10" />
                                <span className="relative z-10 hidden sm:block">{tab.label}</span>
                            </button>
                        )
                    })}
                </div>

                <div className="relative w-full md:w-72 shrink-0">
                    <input
                        type="text"
                        placeholder={`Search ${activeTab}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:border-emerald-500 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none transition-all dark:text-white placeholder:text-gray-400"
                    />
                    <MagnifyingGlassIcon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                </div>
            </div>

            {/* --- CONTENT AREA --- */}
            <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'organizations' && <OrganizationsList items={organizations} />}
                        {activeTab === 'locations' && <LocationsList items={locations} />}
                        {/* {activeTab === 'employees' && <EmployeesList items={organizations} />} */}
                    </motion.div>
                </AnimatePresence>
            </div>

        </div>
    );
}

// ==========================================
// SUB-COMPONENTS (Lists for each entity)
// ==========================================

function OrganizationsList({ items }: { items: Organization[] | null }) {
    console.log(items)
    return !items
        ? <div>error</div>
        : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((org) => (
                    <div key={org.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-6 hover:bg-gray-50 dark:hover:bg-white/2 transition-colors gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <BuildingsIcon className="w-6 h-6" weight="duotone" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white text-lg">{org.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-0.5">Slug: {org.slug}</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-1/2">
                            <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
                                <div className="flex flex-col items-center">
                                    <span className="font-bold text-gray-900 dark:text-white">{org.locations.length}</span>
                                    <span className="text-xs">Locations</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="font-bold text-gray-900 dark:text-white">{org.profiles.length}</span>
                                    <span className="text-xs">Users</span>
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
    return items && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((loc) => (
                <div key={loc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-6 hover:bg-gray-50 dark:hover:bg-white/2 transition-colors gap-4">
                    <div className="flex items-start sm:items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-1 sm:mt-0">
                            <MapPinIcon className="w-5 h-5" weight="duotone" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">{loc.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5"></p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                        <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-lg truncate max-w-30">
                            Pusto
                        </span>
                        <ActionButtons />
                    </div>
                </div>
            ))}
        </div>
    );
}

// function EmployeesList({ items }: { items: Organization[] | null }) {
//     return (
//         <div className="divide-y divide-gray-100 dark:divide-gray-800">
//             {items.map((user) => (
//                 <div key={"user.id"} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-6 hover:bg-gray-50 dark:hover:bg-white/2 transition-colors gap-4">
//                     <div className="flex items-center gap-4">
//                         <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold shrink-0">
//                             {'s'}
//                         </div>
//                         <div>
//                             <h3 className="font-bold text-gray-900 dark:text-white">{"user.name"}</h3>
//                             <p className="text-sm text-gray-500 dark:text-gray-400">{"user.email"}</p>
//                         </div>
//                     </div>
//                     <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
//                         <div className="flex items-center gap-2">
//                             <span className={`px-2 py-1 text-xs font-bold rounded-md ${user === 'Superadmin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' :
//                                 user === 'Manager' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
//                                     'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
//                                 }`}>
//                                 {user}
//                             </span>
//                         </div>
//                         <ActionButtons />
//                     </div>
//                 </div>
//             ))}
//         </div>
//     );
// }

// Универсальные кнопки действий для каждой строки
function ActionButtons() {
    return (
        <div className="flex items-center gap-1">
            <button
                onClick={() => alert('Edit clicked')}
                className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                title="Edit"
            >
                <PencilSimpleIcon className="w-5 h-5" />
            </button>
            <button
                onClick={() => alert('Delete clicked')}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                title="Delete"
            >
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
    );
}
