import { PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { useTranslation } from '@shared/preferences/PreferencesContext';

/**
 * Edit / delete icon buttons shared by every admin list row.
 *
 * The visible icon stays small to suit dense tables, but the tap target is a
 * full 44px on touch (Apple HIG / Material floor) shrinking to 36px on ≥sm where
 * a mouse is precise — so mobile fingers stop hitting the wrong action. Buttons
 * are spaced apart so "delete" isn't a mis-tap away from "edit". Labels are
 * localized for screen readers.
 */
export function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete?: () => void }) {
    const t = useTranslation();
    return (
        <div className="flex items-center gap-1 sm:gap-0.5" onClick={(e) => e.stopPropagation()}>
            <button
                onClick={onEdit}
                className="flex items-center justify-center min-w-11 min-h-11 sm:min-w-9 sm:min-h-9 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                aria-label={t('common.edit')}
            >
                <PencilSimpleIcon className="w-4 h-4" weight="bold" />
            </button>
            {onDelete && (
                <button
                    onClick={onDelete}
                    className="flex items-center justify-center min-w-11 min-h-11 sm:min-w-9 sm:min-h-9 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    aria-label={t('common.delete')}
                >
                    <TrashIcon className="w-4 h-4" weight="bold" />
                </button>
            )}
        </div>
    );
}
