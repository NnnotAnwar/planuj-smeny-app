import type { ReactNode } from 'react';
import {
  AtIcon,
  BuildingsIcon,
  EnvelopeSimpleIcon,
  IdentificationBadgeIcon,
  UserIcon,
} from '@phosphor-icons/react';
import type { Profile } from '@shared/types';
import { getRoleBadgeColor } from '@shared/utils/roleColors';
import { getFullInitials, getFullName } from '@shared/utils/getInitials';

const cardClass =
  'bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm';

interface ProfileFieldProps {
  icon: ReactNode;
  label: string;
  value: string;
}

function ProfileField({ icon, label, value }: ProfileFieldProps) {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-gray-50 dark:border-white/5 last:border-b-0">
      <div className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-micro text-gray-400">{label}</p>
        <p className="text-body-strong text-gray-900 dark:text-white truncate">{value}</p>
      </div>
    </div>
  );
}

export function ProfileView({
  profile,
  organizationName,
  showOrganization = false,
  showHeader = true,
}: {
  profile: Profile;
  organizationName?: string | null;
  showOrganization?: boolean;
  /** Identity card (avatar + name + role). Hidden when a host already shows it (e.g. a modal title). */
  showHeader?: boolean;
}) {
  return (
    <div className="space-y-4">
      {showHeader && (
        <div className={`${cardClass} p-4 flex items-center gap-4`}>
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border-2 border-white dark:border-white/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-lg font-black shrink-0">
            {getFullInitials(profile.first_name, profile.last_name)}
          </div>
          <div className="min-w-0">
            <h2 className="text-title text-gray-900 dark:text-white truncate">{getFullName(profile)}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`inline-block px-2 py-0.5 text-micro rounded-md ${getRoleBadgeColor(profile.role.name)}`}>
                {profile.role.name}
              </span>
              <span className="text-caption text-gray-400 normal-case">@{profile.username}</span>
            </div>
          </div>
        </div>
      )}

      <div className={`${cardClass} overflow-hidden`}>
        <ProfileField
          icon={<UserIcon weight="bold" className="w-4 h-4" />}
          label="First name"
          value={profile.first_name?.trim() || '—'}
        />
        <ProfileField
          icon={<UserIcon weight="bold" className="w-4 h-4" />}
          label="Last name"
          value={profile.last_name?.trim() || '—'}
        />
        <ProfileField
          icon={<EnvelopeSimpleIcon weight="bold" className="w-4 h-4" />}
          label="Email"
          value={profile.email}
        />
        <ProfileField
          icon={<AtIcon weight="bold" className="w-4 h-4" />}
          label="Username"
          value={`@${profile.username}`}
        />
        <ProfileField
          icon={<IdentificationBadgeIcon weight="bold" className="w-4 h-4" />}
          label="Role"
          value={profile.role.name}
        />
        {showOrganization && organizationName && (
          <ProfileField
            icon={<BuildingsIcon weight="bold" className="w-4 h-4" />}
            label="Organization"
            value={organizationName}
          />
        )}
      </div>
    </div>
  );
}
