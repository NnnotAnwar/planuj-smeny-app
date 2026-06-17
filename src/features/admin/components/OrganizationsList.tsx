import { BuildingsIcon } from '@phosphor-icons/react';
import type { Organization } from '@/shared/types';
import { ActionButtons } from './ActionButtons';
import { LoadingState, EmptyState } from './AdminStateViews';

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
    if (isLoading) return <LoadingState label="organizations" />;
    if (items.length === 0) return <EmptyState label="organizations" />;

    return (
        <div className="grid gap-2">
            {items.map((org) => (
                <div
                    key={org.id}
                    className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"
                >
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center shrink-0">
                        <BuildingsIcon className="w-5 h-5" weight="bold" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm dark:text-white truncate">{org.name}</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{org.slug}</p>
                    </div>
                    <div className="flex items-center gap-6 pr-2">
                        <div className="hidden sm:flex gap-4">
                            <div className="text-center">
                                <p className="text-xs font-black dark:text-white">{org.locations.length}</p>
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Locs</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-black dark:text-white">{org.profiles.length}</p>
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Users</p>
                            </div>
                        </div>
                        <ActionButtons onEdit={() => onEdit(org)} onDelete={() => onDelete(org)} />
                    </div>
                </div>
            ))}
        </div>
    );
}
