import { useState } from 'react';
import { MinusIcon, PlusIcon } from '@phosphor-icons/react';
import type { User } from '@shared/types';
import { Modal } from '@features/admin/components/Modal';
import { Button } from '@shared/components/Button';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { toast } from '@shared/toast/toastStore';
import { weekdayLong } from '@shared/utils/date';
import { useCoverage } from './useCoverage';

/**
 * --- MINIMUM STAFFING ---
 * Per location, how many people are needed on each weekday. Saved as one rule
 * per (location, weekday); 0 removes the rule. The rota then flags days that
 * are planned below it (red dot in the grid, "1/2" in the calendar).
 */

const MON_FIRST = [1, 2, 3, 4, 5, 6, 0]; // JS day numbers in display order
const MAX = 20;

export function CoverageDialog({
    user,
    locationId,
    locationName,
    onClose,
}: {
    user: User;
    locationId: string;
    locationName: string;
    onClose: () => void;
}) {
    const t = useTranslation();
    const { list, requiredFor, set, remove } = useCoverage(user);
    const [values, setValues] = useState<number[]>(() => MON_FIRST.map((d) => requiredFor(locationId, d)));
    const [busy, setBusy] = useState(false);

    const bump = (i: number, delta: number) =>
        setValues((prev) => prev.map((v, j) => (j === i ? Math.min(MAX, Math.max(0, v + delta)) : v)));

    const save = async () => {
        setBusy(true);
        try {
            for (const [i, dow] of MON_FIRST.entries()) {
                const next = values[i];
                const rule = (list.data ?? []).find((r) => r.location_id === locationId && r.day_of_week === dow);
                if (next > 0 && next !== rule?.min_headcount) {
                    await set.mutateAsync({ location_id: locationId, day_of_week: dow, min_headcount: next });
                } else if (next === 0 && rule) {
                    await remove.mutateAsync(rule.id);
                }
            }
            toast(t('coverage.saved'), 'success');
            onClose();
        } catch {
            setBusy(false); // the hook already toasted the error
        }
    };

    return (
        <Modal title={t('coverage.title')} subtitle={locationName} onClose={onClose}>
            <div className="space-y-3">
                <p className="text-meta text-ink-soft dark:text-slate-400">{t('coverage.hint')}</p>
                <ul className="divide-y divide-ink/5 rounded-xl bg-white/55 ring-1 ring-ink/5 dark:divide-white/6 dark:bg-white/4 dark:ring-white/6">
                    {MON_FIRST.map((dow, i) => (
                        <li key={dow} className="flex items-center justify-between gap-3 px-3 py-1.5">
                            <span className="text-meta font-semibold capitalize text-ink dark:text-white">{weekdayLong(dow)}</span>
                            <span className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => bump(i, -1)}
                                    disabled={values[i] === 0}
                                    aria-label={`− ${weekdayLong(dow)}`}
                                    className="flex size-7 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-30 dark:text-slate-400 dark:hover:bg-white/8"
                                >
                                    <MinusIcon weight="bold" className="size-3.5" />
                                </button>
                                <span className={`w-6 text-center text-sm font-semibold tabular-nums ${values[i] ? 'text-ink dark:text-white' : 'text-ink-soft/60 dark:text-slate-500'}`}>
                                    {values[i] || '–'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => bump(i, 1)}
                                    disabled={values[i] === MAX}
                                    aria-label={`+ ${weekdayLong(dow)}`}
                                    className="flex size-7 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-30 dark:text-slate-400 dark:hover:bg-white/8"
                                >
                                    <PlusIcon weight="bold" className="size-3.5" />
                                </button>
                            </span>
                        </li>
                    ))}
                </ul>
                <div className="flex gap-2 pt-1">
                    <Button variant="secondary" fullWidth onClick={onClose} disabled={busy}>
                        {t('common.cancel')}
                    </Button>
                    <Button fullWidth loading={busy} onClick={() => void save()}>
                        {t('common.save')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
