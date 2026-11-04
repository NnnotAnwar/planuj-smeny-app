import { useState } from 'react';
import { CalendarStarIcon, CheckIcon } from '@phosphor-icons/react';
import { Modal } from '@features/admin/components/Modal';
import { Button } from '@shared/components/Button';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { formatDateLong } from '@shared/utils/date';

/**
 * --- HOLIDAY WARNING ---
 * Managers may plan a shift on a public holiday, but are asked once first —
 * with a "don't show this again" box (remembered per device via
 * useDismissibleWarning('assign-on-holiday')). `HolidayWarningBody` is the
 * shared message + checkbox; the shift editor shows it inline as a confirm
 * step, the roster grid wraps it in `HolidayWarningDialog`.
 */
export const HOLIDAY_WARNING_KEY = 'assign-on-holiday';

export function HolidayWarningBody({
    date,
    name,
    dontShow,
    onDontShowChange,
}: {
    date: string; // YYYY-MM-DD
    name: string;
    dontShow: boolean;
    onDontShowChange: (v: boolean) => void;
}) {
    const t = useTranslation();
    return (
        <div className="rounded-xl bg-rose-500/8 p-3 ring-1 ring-rose-500/15 dark:bg-rose-400/10">
            <div className="flex gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/12 text-rose-600 dark:text-rose-300">
                    <CalendarStarIcon weight="fill" className="size-4" />
                </span>
                <p className="text-meta text-ink dark:text-slate-200">
                    {t('holiday.warnBody', { date: formatDateLong(`${date}T00:00`), name })}
                </p>
            </div>
            <label className="mt-2.5 flex cursor-pointer items-center gap-2 pl-10.5 text-meta text-ink-soft dark:text-slate-400">
                <button
                    type="button"
                    role="checkbox"
                    aria-checked={dontShow}
                    onClick={() => onDontShowChange(!dontShow)}
                    className={`flex size-4 items-center justify-center rounded border transition-colors ${
                        dontShow ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-ink/25 dark:border-white/25'
                    }`}
                >
                    {dontShow && <CheckIcon weight="bold" className="size-3" />}
                </button>
                <span onClick={() => onDontShowChange(!dontShow)}>{t('holiday.dontShow')}</span>
            </label>
        </div>
    );
}

export function HolidayWarningDialog({
    date,
    name,
    onConfirm,
    onClose,
}: {
    date: string;
    name: string;
    /** Proceed; `dontShowAgain` tells the caller to silence future warnings. */
    onConfirm: (dontShowAgain: boolean) => void;
    onClose: () => void;
}) {
    const t = useTranslation();
    const [dontShow, setDontShow] = useState(false);
    return (
        <Modal title={t('holiday.label')} onClose={onClose}>
            <div className="space-y-4">
                <HolidayWarningBody date={date} name={name} dontShow={dontShow} onDontShowChange={setDontShow} />
                <div className="flex gap-2">
                    <Button variant="secondary" fullWidth onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button fullWidth onClick={() => onConfirm(dontShow)}>
                        {t('holiday.assignAnyway')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
