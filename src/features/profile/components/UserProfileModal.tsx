import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowSquareOutIcon, ClockUserIcon } from '@phosphor-icons/react';
import { Modal } from '@features/admin/components/Modal';
import { useAuthContext } from '@features/auth/AuthContext';
import { isSuperAdmin } from '@shared/auth/permissions';
import { usePermissions } from '@shared/auth/usePermissions';
import { getFullName } from '@shared/utils/getInitials';
import { profileService } from '../profileService';
import { ProfileView } from './ProfileView';

/**
 * --- USER PROFILE MODAL ---
 * Opens a colleague's profile from just their user id, fetching the full record
 * (RLS scopes it to the same organization, or all orgs for a superadmin). Reuses
 * the ['profile', userId] query key so opening the full profile page is instant.
 * Used wherever we only have a user id to go on — the live board, the timesheet
 * header and the activity log.
 */
export function UserProfileModal({ userId, onClose }: { userId: string; onClose: () => void }) {
    const { user } = useAuthContext();
    const { canViewAdminPanel } = usePermissions();
    const showOrganization = !!user && isSuperAdmin(user);
    const isSelf = user?.id === userId;

    const { data: profile, isLoading, error } = useQuery({
        queryKey: ['profile', userId],
        queryFn: () => profileService.getProfile(userId),
        enabled: !!userId,
    });

    const title = profile ? getFullName(profile) : 'Profile';
    const subtitle = profile ? `@${profile.username}` : undefined;

    return (
        <Modal title={title} subtitle={subtitle} onClose={onClose}>
            {isLoading ? (
                <div className="py-12 flex justify-center">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : error || !profile ? (
                <div className="rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-4">
                    <p className="text-body text-red-600 dark:text-red-400">
                        {error instanceof Error ? error.message : 'Profile not found or you do not have access.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <ProfileView
                        profile={profile}
                        organizationName={profile.organizationName}
                        showOrganization={showOrganization}
                        showHeader={false}
                    />

                    {canViewAdminPanel && (
                        <Link
                            to={`/timesheets?member=${profile.id}`}
                            onClick={onClose}
                            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-body-strong text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        >
                            <ClockUserIcon weight="bold" className="w-4 h-4" />
                            View timesheets
                        </Link>
                    )}

                    {!isSelf && (
                        <Link
                            to={`/profile/${profile.id}`}
                            onClick={onClose}
                            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-body-strong text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/25 transition-colors"
                        >
                            <ArrowSquareOutIcon weight="bold" className="w-4 h-4" />
                            Open profile page
                        </Link>
                    )}
                </div>
            )}
        </Modal>
    );
}
