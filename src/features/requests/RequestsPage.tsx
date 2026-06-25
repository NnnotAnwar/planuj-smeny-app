import { Navigate } from 'react-router-dom';
import { UserCircleGearIcon } from '@phosphor-icons/react';

import { useAuthContext } from '@/features/auth/AuthContext';
import { canManageEmployees } from '@shared/auth/permissions';
import { AdminProvider, useAdminContext } from '@/features/admin/AdminContext';
import { NameChangeRequestsList } from '@/features/admin/components/NameChangeRequestsList';
import { ErrorState } from '@/features/admin/components/AdminStateViews';

/**
 * --- REQUESTS PAGE ---
 * A dedicated hub for staff requests an admin needs to action. Today it holds
 * name-change requests; it's structured as sections so future request types
 * (time off, etc.) can be added alongside. Admin-only (rank >= 30).
 */
export function RequestsPage() {
    const { user } = useAuthContext();

    // Only admins (rank >= 30) review requests; everyone else goes home.
    if (user && !canManageEmployees(user)) return <Navigate to="/" replace />;

    return (
        <AdminProvider>
            <RequestsInner />
        </AdminProvider>
    );
}

function RequestsInner() {
    const { nameRequests, nameRequestsLoading, reviewNameRequest, error } = useAdminContext();

    return (
        <div className="space-y-4 px-1 pb-10">
            <header className="flex items-end justify-between gap-3 pt-2">
                <div className="space-y-0.5">
                    <p className="text-label text-emerald-500 text-left">Administration</p>
                    <h1 className="text-display text-gray-900 dark:text-white">Requests</h1>
                </div>
                {nameRequests.length > 0 && (
                    <span className="flex items-center gap-1.5 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm text-xs font-black text-emerald-600 dark:text-emerald-400">
                        {nameRequests.length} pending
                    </span>
                )}
            </header>

            <section className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                    <UserCircleGearIcon weight="bold" className="w-4 h-4 text-emerald-500" />
                    <h2 className="text-label text-gray-400">Name changes</h2>
                </div>

                {error ? (
                    <ErrorState message={error} />
                ) : (
                    <NameChangeRequestsList
                        items={nameRequests}
                        isLoading={nameRequestsLoading}
                        onReview={reviewNameRequest}
                    />
                )}
            </section>
        </div>
    );
}
