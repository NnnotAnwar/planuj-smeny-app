import { PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';

/** Edit / delete icon buttons shared by every admin list row. */
export function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete?: () => void }) {
    return (
        <div className="flex items-center gap-0.5">
            <button
                onClick={onEdit}
                className="p-1.5 sm:p-2.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                aria-label="Edit"
            >
                <PencilSimpleIcon className="w-4 h-4" weight="bold" />
            </button>
            {onDelete && (
                <button
                    onClick={onDelete}
                    className="p-1.5 sm:p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    aria-label="Delete"
                >
                    <TrashIcon className="w-4 h-4" weight="bold" />
                </button>
            )}
        </div>
    );
}
