import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GearIcon } from '@phosphor-icons/react';
import { useAuthContext } from '@features/auth/AuthContext';
import { isSuperAdmin } from '@shared/auth/permissions';
import { PageLoader } from '@shared/components/PageLoader';
import type { ProfileDetail } from '@shared/types';
import { profileService } from './profileService';
import { ProfileView } from './components/ProfileView';

export default function ProfilePage() {
  const { userId } = useParams();
  const { user: currentUser } = useAuthContext();

  const targetId = userId ?? currentUser?.id;
  const isSelf = !!currentUser && targetId === currentUser.id;
  const showOrganization = !!currentUser && isSuperAdmin(currentUser);

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile', targetId],
    queryFn: () => profileService.getProfile(targetId!),
    enabled: !!targetId,
    // Viewing our own profile: seed from the already-loaded auth user so there's
    // no loader flash; the query still refetches the full record in the background.
    initialData: (isSelf ? currentUser : undefined) as ProfileDetail | undefined,
  });

  if (!currentUser || !targetId) return null;

  if (isLoading) return <PageLoader />;

  if (error || !profile) {
    return (
      <div className="space-y-4 px-1 pb-10">
        <header className="pt-2 space-y-0.5">
          <p className="text-label text-emerald-500 text-left">Account</p>
          <h1 className="text-display text-gray-900 dark:text-white">Profile</h1>
        </header>
        <div className="rounded-3xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-5">
          <p className="text-body text-red-600 dark:text-red-400">
            {error instanceof Error ? error.message : 'Profile not found or you do not have access.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-1 pb-10">
      <header className="pt-2 flex items-start justify-between gap-4">
        <div className="space-y-0.5 min-w-0">
          <p className="text-label text-emerald-500 text-left">Account</p>
          <h1 className="text-display text-gray-900 dark:text-white">{isSelf ? 'My profile' : 'Employee profile'}</h1>
        </div>
        {isSelf && (
          <Link
            to="/settings"
            className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-small-strong text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/25 transition-colors"
          >
            <GearIcon weight="bold" className="w-4 h-4" />
            Settings
          </Link>
        )}
      </header>

      <ProfileView
        profile={profile}
        organizationName={profile.organizationName}
        showOrganization={showOrganization}
      />
    </div>
  );
}
