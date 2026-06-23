import { Navigate } from 'react-router-dom';
import { UserCircleGearIcon } from '@phosphor-icons/react';

import { useAuthContext } from '@/features/auth/AuthContext';
import { canManageEmployees } from '@/features/admin/permissions';
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
        <div className="space-y-6 px-1 max-w-3xl mx-auto w-full">
            <header className="space-y-0.5">
                <p className="text-label text-emerald-500">Administration</p>
                <h1 className="text-display text-gray-900 dark:text-white">Requests</h1>
                <p className="text-small text-gray-400">Review and action staff requests.</p>
            </header>

            <section className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                    <UserCircleGearIcon weight="bold" className="w-4 h-4 text-emerald-500" />
                    <h2 className="text-label text-gray-400">Name changes</h2>
                    {nameRequests.length > 0 && (
                        <span className="min-w-5 h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center">
                            {nameRequests.length}
                        </span>
                    )}
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
