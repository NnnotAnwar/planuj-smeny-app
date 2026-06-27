import { BuildingsIcon } from '@phosphor-icons/react';
import type { Organization } from '@/shared/types';
import { DataTable, type Column } from '@/shared/components/DataTable';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { ActionButtons } from './ActionButtons';
import { EmptyState } from './AdminStateViews';

function OrgIdentity({ org }: { org: Organization }) {
    return (
        <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center shrink-0">
                <BuildingsIcon className="w-4 h-4 sm:w-5 sm:h-5" weight="bold" />
            </div>
            <div className="min-w-0">
                <h3 className="text-body-strong dark:text-white truncate">{org.name}</h3>
                <p className="text-micro text-gray-400 truncate normal-case">{org.slug}</p>
            </div>
        </div>
    );
}

export function OrganizationsList({
    items,
    isLoading,
    onEdit,
    onDelete,
}: {
    items: Organization[];
    isLoading: boolean;
    onEdit: (org: Organization) => void;
    onDelete: (org: Organization) => void;
}) {
    const t = useTranslation();
    const columns: Column<Organization>[] = [
        { key: 'org', header: t('profile.field.organization'), render: (org) => <OrgIdentity org={org} /> },
        { key: 'locs', header: t('admin.colLocs'), align: 'right', width: 'w-20', hideOnMobile: true, render: (org) => <span className="text-metric-sm dark:text-white">{org.locations.length}</span> },
        { key: 'users', header: t('admin.colUsers'), align: 'right', width: 'w-16 sm:w-20', render: (org) => <span className="text-metric-sm dark:text-white">{org.profiles.length}</span> },
        { key: 'actions', header: '', align: 'right', width: 'w-20 sm:w-28', render: (org) => <div className="flex justify-end"><ActionButtons onEdit={() => onEdit(org)} onDelete={() => onDelete(org)} /></div> },
    ];

    return (
        <DataTable
            rows={items}
            rowKey={(org) => org.id}
            columns={columns}
            isLoading={isLoading}
            emptyState={<EmptyState label={t('admin.nounOrganizations')} />}
        />
    );
}
