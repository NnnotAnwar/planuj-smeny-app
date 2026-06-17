import { MapPinIcon } from '@phosphor-icons/react';
import { ActionButtons } from './ActionButtons';
import { LoadingState, EmptyState } from './AdminStateViews';

export interface LocationRow {
    id: string;
    name: string;
    organization_id: string;
    organizationName: string;
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
    if (isLoading) return <LoadingState label="locations" />;
    if (items.length === 0) return <EmptyState label="locations" />;

    return (
        <div className="grid gap-2">
            {items.map((loc) => (
                <div
                    key={loc.id}
                    className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"
                >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center shrink-0">
                        <MapPinIcon className="w-5 h-5" weight="bold" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm dark:text-white truncate">{loc.name}</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{loc.organizationName}</p>
                    </div>
                    <div className="flex items-center gap-4 pr-2">
                        <span className="hidden sm:inline-block px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 text-[8px] font-black rounded uppercase tracking-widest">
                            {loc.id.slice(0, 8)}
                        </span>
                        {canManage && <ActionButtons onEdit={() => onEdit(loc)} onDelete={() => onDelete(loc)} />}
                    </div>
                </div>
            ))}
        </div>
    );
}
