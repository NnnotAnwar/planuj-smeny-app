import { PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { useTranslation } from '@shared/preferences/PreferencesContext';

/**
 * Edit / delete icon buttons shared by every admin/timesheet list row.
 *
 * These live in a `table-fixed` actions column that can be as narrow as w-16
 * (64px) on phones, so the tap area is tall (44px, comfortable) but kept
 * horizontally compact (icon + tight padding) — two buttons fit the column
 * instead of spilling over the neighbouring cells. Labels are localized for
 * screen readers.
 */
const BTN =
    'flex items-center justify-center shrink-0 min-h-11 px-1.5 sm:px-2.5 rounded-lg text-gray-400 transition-colors';

export function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete?: () => void }) {
    const t = useTranslation();
    return (
        <div className="flex items-center justify-end gap-0.5 sm:gap-1" onClick={(e) => e.stopPropagation()}>
            <button
                onClick={onEdit}
                className={`${BTN} hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10`}
                aria-label={t('common.edit')}
            >
                <PencilSimpleIcon className="w-4 h-4" weight="bold" />
            </button>
            {onDelete && (
                <button
                    onClick={onDelete}
                    className={`${BTN} hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10`}
                    aria-label={t('common.delete')}
                >
                    <TrashIcon className="w-4 h-4" weight="bold" />
                </button>
            )}
        </div>
    );
}
