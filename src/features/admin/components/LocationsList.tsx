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
        <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center shrink-0">
                <MapPinIcon className="w-5 h-5" weight="bold" />
            </div>
            <div className="min-w-0">
                <h3 className="text-body-strong dark:text-white truncate">{loc.name}</h3>
                <p className="text-micro text-gray-400">{loc.organizationName}</p>
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
        { key: 'loc', header: 'Location', render: (loc) => <LocationIdentity loc={loc} /> },
        { key: 'org', header: 'Organization', render: (loc) => <span className="text-body text-gray-500 dark:text-gray-400 truncate">{loc.organizationName}</span> },
        { key: 'id', header: 'ID', align: 'right', render: (loc) => <span className="text-micro text-gray-400">{loc.id.slice(0, 8)}</span> },
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
            mobileCard={(loc) => (
                <div className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <LocationIdentity loc={loc} />
                    {canManage && (
                        <div className="ml-auto pr-1">
                            <ActionButtons onEdit={() => onEdit(loc)} onDelete={() => onDelete(loc)} />
                        </div>
                    )}
                </div>
            )}
        />
    );
}
