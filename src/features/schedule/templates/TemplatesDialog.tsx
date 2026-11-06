import { useState } from 'react';
import { PlusIcon, TrashIcon } from '@phosphor-icons/react';
import type { User } from '@shared/types';
import { Modal } from '@features/admin/components/Modal';
import { Button } from '@shared/components/Button';
import { FormError } from '@shared/components/FormError';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { useShiftTemplates } from './useShiftTemplates';
import { MAX_TEMPLATES, tplTime } from './templateTime';

/**
 * --- MANAGE TEMPLATES ---
 * One place to tidy the org's shift templates: rename, retime, delete, add.
 * Edits are kept locally and saved together; a template saved from a cell or
 * a member row arrives named after its times, so renaming happens here.
 */

interface Draft {
    id: string | null; // null = new, not saved yet
    name: string;
    start: string;
    end: string;
}

export function TemplatesDialog({ user, onClose }: { user: User; onClose: () => void }) {
    const t = useTranslation();
    const { list, create, update, remove } = useShiftTemplates(user);
    const [drafts, setDrafts] = useState<Draft[]>(() =>
        (list.data ?? []).map((tpl) => ({ id: tpl.id, name: tpl.name, start: tplTime(tpl.start_time), end: tplTime(tpl.end_time) })),
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const patch = (i: number, p: Partial<Draft>) => setDrafts((prev) => prev.map((d, j) => (j === i ? { ...d, ...p } : d)));

    const save = async () => {
        if (drafts.some((d) => !d.start || !d.end)) return setError(t('avail.badTime'));
        setBusy(true);
        setError(null);
        try {
            for (const d of drafts) {
                const name = d.name.trim() || `${d.start}–${d.end}`;
                if (!d.id) {
                    await create.mutateAsync({ name, start_time: d.start, end_time: d.end });
                    continue;
                }
                const orig = list.data?.find((tpl) => tpl.id === d.id);
                if (orig && (orig.name !== name || tplTime(orig.start_time) !== d.start || tplTime(orig.end_time) !== d.end)) {
                    await update.mutateAsync({ id: d.id, patch: { name, start_time: d.start, end_time: d.end } });
                }
            }
            onClose();
        } catch {
            setBusy(false); // the hook already toasted
        }
    };

    const drop = (i: number) => {
        const d = drafts[i];
        if (d.id) remove.mutate(d.id);
        setDrafts((prev) => prev.filter((_, j) => j !== i));
    };

    const field =
        'min-w-0 rounded-lg border border-ink/10 bg-white/80 px-2 py-1.5 text-meta text-ink outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-white';

    return (
        <Modal title={t('tpl.manage')} onClose={onClose}>
            <div className="space-y-3">
                <p className="text-meta text-ink-soft dark:text-slate-400">{t('tpl.manageHint')}</p>
                {drafts.length === 0 && <p className="text-meta text-ink-soft dark:text-slate-400">{t('tpl.empty')}</p>}
                <ul className="space-y-1.5">
                    {drafts.map((d, i) => (
                        <li key={d.id ?? `new-${i}`} className="flex items-center gap-1.5">
                            <input
                                value={d.name}
                                onChange={(e) => patch(i, { name: e.target.value })}
                                placeholder={t('tpl.namePh')}
                                maxLength={40}
                                aria-label={t('tpl.name')}
                                className={`${field} flex-1`}
                            />
                            <input type="time" value={d.start} onChange={(e) => patch(i, { start: e.target.value })} aria-label={t('shiftEditor.startTime')} className={`${field} w-24 tabular-nums`} />
                            <span className="text-ink-soft">–</span>
                            <input type="time" value={d.end} onChange={(e) => patch(i, { end: e.target.value })} aria-label={t('shiftEditor.endTime')} className={`${field} w-24 tabular-nums`} />
                            <button
                                type="button"
                                onClick={() => drop(i)}
                                title={t('tpl.remove')}
                                aria-label={`${t('tpl.remove')}: ${d.name}`}
                                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:text-slate-400"
                            >
                                <TrashIcon weight="bold" className="size-3.5" />
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="flex items-center justify-between gap-3">
                    <Button
                        size="sm"
                        variant="tonal"
                        icon={PlusIcon}
                        disabled={drafts.length >= MAX_TEMPLATES}
                        onClick={() => setDrafts((prev) => [...prev, { id: null, name: '', start: '08:00', end: '16:00' }])}
                    >
                        {t('tpl.add')}
                    </Button>
                    <span className={`text-caption tabular-nums ${drafts.length >= MAX_TEMPLATES ? 'text-amber-600 dark:text-amber-300' : 'text-ink-soft dark:text-slate-400'}`}>
                        {drafts.length >= MAX_TEMPLATES ? t('tpl.limitShort', { max: MAX_TEMPLATES }) : t('tpl.count', { n: drafts.length, max: MAX_TEMPLATES })}
                    </span>
                </div>
                <FormError message={error} />
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
