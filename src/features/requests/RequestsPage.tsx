import { Navigate } from 'react-router-dom';
import { UserCircleGearIcon } from '@phosphor-icons/react';

import { useAuthContext } from '@/features/auth/AuthContext';
import { canManageEmployees } from '@shared/auth/permissions';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { AdminProvider, useAdminContext } from '@/features/admin/AdminContext';
import { NameChangeRequestsList } from '@/features/admin/components/NameChangeRequestsList';
import { ErrorState } from '@/features/admin/components/AdminStateViews';
import { PageHeader } from '@shared/components/PageHeader';

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
    const t = useTranslation();

    return (
        <div className="space-y-4 px-1 pb-10">
            <PageHeader
                eyebrow={t('admin.administration')}
                title={t('nav.requests')}
                actions={
                    <>
                        {nameRequests.length > 0 && (
                            <span className="glass flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                {t('requests.pending', { count: nameRequests.length })}
                            </span>
                        )}
                    </>
                }
            />

            <section className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                    <UserCircleGearIcon weight="bold" className="w-4 h-4 text-emerald-500" />
                    <h2 className="text-label text-gray-400">{t('requests.nameChanges')}</h2>
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
