import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GearIcon, PencilSimpleIcon, CheckIcon, ClockUserIcon } from '@phosphor-icons/react';
import { useAuthContext } from '@features/auth/AuthContext';
import { isSuperAdmin, canViewAdminPanel } from '@shared/auth/permissions';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { PageLoader } from '@shared/components/PageLoader';
import type { ProfileDetail } from '@shared/types';
import { profileService } from './profileService';
import { ProfileView } from './components/ProfileView';
import { ProfileEditor } from './components/ProfileEditor';

export default function ProfilePage() {
  const { userId } = useParams();
  const { user: currentUser } = useAuthContext();
  const t = useTranslation();
  const [isEditing, setIsEditing] = useState(false);

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
          <p className="text-label text-emerald-500 text-left">{t('profile.account')}</p>
          <h1 className="text-display text-gray-900 dark:text-white">{t('profile.title')}</h1>
        </header>
        <div className="rounded-3xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-5">
          <p className="text-body text-red-600 dark:text-red-400">
            {error instanceof Error ? error.message : t('profile.notFound')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-1 pb-10">
      <header className="pt-2 flex items-start justify-between gap-4">
        <div className="space-y-0.5 min-w-0">
          <p className="text-label text-emerald-500 text-left">{t('profile.account')}</p>
          <h1 className="text-display text-gray-900 dark:text-white">{isSelf ? t('profile.my') : t('profile.employee')}</h1>
        </div>
        {isSelf && (
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={() => setIsEditing((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-small-strong text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/25 transition-colors"
            >
              {isEditing ? <CheckIcon weight="bold" className="w-4 h-4" /> : <PencilSimpleIcon weight="bold" className="w-4 h-4" />}
              {isEditing ? t('profile.done') : t('profile.edit')}
            </button>
            {!isEditing && (
              <Link
                to="/settings"
                aria-label={t('nav.settings')}
                className="flex items-center justify-center p-2 rounded-xl text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                <GearIcon weight="bold" className="w-4 h-4" />
              </Link>
            )}
          </div>
        )}
      </header>

      {isSelf && isEditing ? (
        <ProfileEditor />
      ) : (
        <ProfileView
          profile={profile}
          organizationName={profile.organizationName}
          showOrganization={showOrganization}
        />
      )}

      {!isEditing && !isSelf && currentUser && canViewAdminPanel(currentUser) && (
        <Link
          to={`/timesheets?member=${profile.id}`}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-body-strong text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
        >
          <ClockUserIcon weight="bold" className="w-4 h-4" />
          {t('profile.viewTimesheets')}
        </Link>
      )}
    </div>
  );
}
