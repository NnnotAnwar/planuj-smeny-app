import { Link } from 'react-router-dom';
import { ArrowSquareOutIcon, ClockUserIcon } from '@phosphor-icons/react';
import { Modal } from '@features/admin/components/Modal';
import type { Profile } from '@shared/types';
import { getFullName } from '@shared/utils/getInitials';
import { usePermissions } from '@shared/auth/usePermissions';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { ProfileView } from './ProfileView';

export function EmployeeProfileModal({
  employee,
  organizationName,
  showOrganization = false,
  isSelf = false,
  onClose,
}: {
  employee: Profile;
  organizationName?: string | null;
  showOrganization?: boolean;
  isSelf?: boolean;
  onClose: () => void;
}) {
  const { canViewAdminPanel } = usePermissions();
  const t = useTranslation();

  return (
    <Modal title={getFullName(employee)} subtitle={`@${employee.username}`} onClose={onClose}>
      <div className="space-y-4">
        <ProfileView
          profile={employee}
          organizationName={organizationName}
          showOrganization={showOrganization}
          showHeader={false}
        />

        {canViewAdminPanel && (
          <Link
            to={`/timesheets?member=${employee.id}`}
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-body-strong text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <ClockUserIcon weight="bold" className="w-4 h-4" />
            {t('profile.viewTimesheets')}
          </Link>
        )}

        {!isSelf && (
          <Link
            to={`/profile/${employee.id}`}
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-body-strong text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/25 transition-colors"
          >
            <ArrowSquareOutIcon weight="bold" className="w-4 h-4" />
            {t('profile.openPage')}
          </Link>
        )}
      </div>
    </Modal>
  );
}
