import { MapPinIcon } from '@phosphor-icons/react';
import { DataTable, type Column } from '@/shared/components/DataTable';
import { ActionButtons } from './ActionButtons';
import { LoadingState, EmptyState } from './AdminStateViews';

export interface LocationRow {
    id: string;
    name: string;
    organization_id: string;
    organizationName: string;
}

function LocationIdentity({ loc }: { loc: LocationRow }) {
    return (
        <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center shrink-0">
                <MapPinIcon className="w-4 h-4 sm:w-5 sm:h-5" weight="bold" />
            </div>
            <div className="min-w-0">
                <h3 className="text-body-strong dark:text-white truncate">{loc.name}</h3>
                <p className="text-micro text-gray-400 truncate">{loc.organizationName}</p>
            </div>
        </div>
    );
}

export function LocationsList({
    items,
    isLoading,
    canManage,
    onEdit,
    onDelete,
}: {
    items: LocationRow[];
    isLoading: boolean;
    canManage: boolean;
    onEdit: (loc: LocationRow) => void;
    onDelete: (loc: LocationRow) => void;
}) {
    const columns: Column<LocationRow>[] = [
        { key: 'loc', header: 'Location', render: (loc) => <LocationIdentity loc={loc} />, className: 'max-w-[70vw] sm:max-w-none' },
        { key: 'org', header: 'Organization', hideOnMobile: true, render: (loc) => <span className="text-body text-gray-500 dark:text-gray-400 truncate">{loc.organizationName}</span> },
        { key: 'id', header: 'ID', align: 'right', hideOnMobile: true, render: (loc) => <span className="text-micro text-gray-400 normal-case whitespace-nowrap">{loc.id.slice(0, 8)}</span> },
        ...(canManage
            ? [{ key: 'actions', header: '', align: 'right' as const, render: (loc: LocationRow) => <div className="flex justify-end"><ActionButtons onEdit={() => onEdit(loc)} onDelete={() => onDelete(loc)} /></div> }]
            : []),
    ];

    return (
        <DataTable
            rows={items}
            rowKey={(loc) => loc.id}
            columns={columns}
            isLoading={isLoading}
            loadingState={<LoadingState label="locations" />}
            emptyState={<EmptyState label="locations" />}
        />
    );
}
