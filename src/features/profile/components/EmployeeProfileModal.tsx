import { Link } from 'react-router-dom';
import { ArrowSquareOutIcon } from '@phosphor-icons/react';
import { Modal } from '@features/admin/components/Modal';
import type { Profile } from '@shared/types';
import { getFullName } from '@shared/utils/getInitials';
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
  return (
    <Modal title={getFullName(employee)} subtitle={`@${employee.username}`} onClose={onClose}>
      <div className="space-y-4">
        <ProfileView
          profile={employee}
          organizationName={organizationName}
          showOrganization={showOrganization}
          showHeader={false}
        />

        {!isSelf && (
          <Link
            to={`/profile/${employee.id}`}
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-body-strong text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/25 transition-colors"
          >
            <ArrowSquareOutIcon weight="bold" className="w-4 h-4" />
            Open profile page
          </Link>
        )}
      </div>
    </Modal>
  );
}
