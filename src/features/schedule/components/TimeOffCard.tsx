import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SunHorizonIcon, CheckIcon, XIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import type { Profile, TimeOff } from '@shared/types';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { Button } from '@shared/components/Button';
import { Select } from '@shared/components/Select';
import { DatePicker } from '@shared/components/DatePicker';
import { Textarea } from '@shared/components/Input';
import { Modal } from '@features/admin/components/Modal';
import { FormError } from '@shared/components/FormError';
import { toast } from '@shared/toast/toastStore';
import { formatDateShort } from '@shared/utils/date';
import { scheduleService } from '../scheduleService';

/**
 * --- TIME OFF CARD ---
 * Leave management on the schedule page. Managers see pending requests to
 * approve/decline and can enter (pre-approved) leave for their people;
 * members file requests and see their status / withdraw pending ones.
 */

const KIND_KEYS = {
    vacation: 'timeoff.vacation',
    sick: 'timeoff.sick',
    other: 'timeoff.other',
} as const;

const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function RequestModal({
    members,
    selfId,
    orgId,
    managerMode,
    onClose,
}: {
    members: Profile[];
    selfId: string;
    orgId: string;
    managerMode: boolean;
    onClose: () => void;
}) {
    const t = useTranslation();
    const qc = useQueryClient();
    const [userId, setUserId] = useState(selfId);
    const [kind, setKind] = useState<TimeOff['kind']>('vacation');
    const [from, setFrom] = useState(todayStr());
    const [to, setTo] = useState(todayStr());
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        setError(null);
        if (to < from) return setError(t('timeoff.badRange'));
        setBusy(true);
        try {
            await scheduleService.requestTimeOff({
                user_id: userId,
                organization_id: orgId,
                kind,
                starts_on: from,
                ends_on: to,
                note: note.trim() || null,
                // A manager entering leave (for anyone incl. self) approves it directly.
                approved: managerMode,
                reviewed_by: managerMode ? selfId : null,
            });
            qc.invalidateQueries({ queryKey: ['time-off'] });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('common.actionFailed'));
            setBusy(false);
        }
    };

    const name = (m: Profile) => [m.first_name, m.last_name].filter(Boolean).join(' ') || m.username;

    return (
        <Modal title={managerMode ? t('timeoff.add') : t('timeoff.request')} onClose={onClose}>
            <div className="space-y-4">
                {managerMode && (
                    <div className="space-y-1.5">
                        <label className="text-label text-gray-400">{t('schedule.member')}</label>
                        <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
                            {members.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {name(m)}
                                </option>
                            ))}
                        </Select>
                    </div>
                )}
                <div className="space-y-1.5">
                    <label className="text-label text-gray-400">{t('timeoff.kind')}</label>
                    <Select value={kind} onChange={(e) => setKind(e.target.value as TimeOff['kind'])}>
                        {(Object.keys(KIND_KEYS) as Array<TimeOff['kind']>).map((k) => (
                            <option key={k} value={k}>
                                {t(KIND_KEYS[k])}
                            </option>
                        ))}
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-label text-gray-400">{t('timeoff.from')}</label>
                        <DatePicker value={from} onChange={setFrom} aria-label={t('timeoff.from')} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-label text-gray-400">{t('timeoff.to')}</label>
                        <DatePicker value={to} onChange={setTo} aria-label={t('timeoff.to')} />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-label text-gray-400">{t('schedule.note')}</label>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t('schedule.notePlaceholder')} />
                </div>
                <FormError message={error} />
                <div className="flex gap-2 pt-1">
                    <Button variant="secondary" fullWidth onClick={onClose} disabled={busy}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" fullWidth loading={busy} onClick={submit}>
                        {busy ? t('common.saving') : managerMode ? t('common.save') : t('timeoff.send')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

const STATUS_TONE: Record<TimeOff['status'], string> = {
    pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    approved: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    declined: 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400',
};

export function TimeOffCard({
    entries,
    members,
    selfId,
    orgId,
    managerMode,
}: {
    /** This month's leave entries (already scoped by RLS). */
    entries: TimeOff[];
    members: Profile[];
    selfId: string;
    orgId: string;
    managerMode: boolean;
}) {
    const t = useTranslation();
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);

    const invalidate = () => qc.invalidateQueries({ queryKey: ['time-off'] });
    const reviewM = useMutation({
        mutationFn: ({ id, approve }: { id: string; approve: boolean }) => scheduleService.reviewTimeOff(id, approve, selfId),
        onSuccess: invalidate,
        onError: (err) => toast(err instanceof Error ? err.message : t('common.actionFailed'), 'error'),
    });
    const deleteM = useMutation({
        mutationFn: (id: string) => scheduleService.deleteTimeOff(id),
        onSuccess: invalidate,
        onError: (err) => toast(err instanceof Error ? err.message : t('common.actionFailed'), 'error'),
    });

    const visible = managerMode ? entries : entries.filter((e) => e.user_id === selfId);
    const pending = visible.filter((e) => e.status === 'pending');
    const decided = visible.filter((e) => e.status !== 'pending');

    const personName = (e: TimeOff) =>
        `${e.profiles?.first_name ?? ''} ${e.profiles?.last_name ?? ''}`.trim() || e.profiles?.username || '—';
    const range = (e: TimeOff) =>
        e.starts_on === e.ends_on
            ? formatDateShort(`${e.starts_on}T00:00`)
            : `${formatDateShort(`${e.starts_on}T00:00`)} – ${formatDateShort(`${e.ends_on}T00:00`)}`;

    return (
        <section className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/40 shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <SunHorizonIcon weight="fill" className="w-4 h-4" />
                </span>
                <p className="flex-1 text-body-strong text-gray-900 dark:text-white">
                    {t('timeoff.title')}
                    {pending.length > 0 && <span className="text-amber-500 font-normal"> · {pending.length}</span>}
                </p>
                <Button size="sm" variant="tonal" icon={PlusIcon} onClick={() => setOpen(true)}>
                    {managerMode ? t('timeoff.add') : t('timeoff.request')}
                </Button>
            </div>

            {visible.length > 0 && (
                <ul className="space-y-1.5">
                    {[...pending, ...decided].map((e) => (
                        <li key={e.id} className="flex items-center gap-2 text-small">
                            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-micro font-bold normal-case tracking-normal ${STATUS_TONE[e.status]}`}>
                                {t(KIND_KEYS[e.kind])}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">
                                {managerMode && <span className="font-semibold">{personName(e)} · </span>}
                                {range(e)}
                                {e.note ? <span className="text-gray-400"> · {e.note}</span> : null}
                            </span>
                            {e.status === 'pending' && managerMode ? (
                                <span className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => reviewM.mutate({ id: e.id, approve: true })}
                                        aria-label={t('common.approve')}
                                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                    >
                                        <CheckIcon weight="bold" className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => reviewM.mutate({ id: e.id, approve: false })}
                                        aria-label={t('common.reject')}
                                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        <XIcon weight="bold" className="w-4 h-4" />
                                    </button>
                                </span>
                            ) : e.status === 'pending' || managerMode ? (
                                <button
                                    onClick={() => deleteM.mutate(e.id)}
                                    aria-label={t('timeoff.withdraw')}
                                    title={t('timeoff.withdraw')}
                                    className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    <TrashIcon weight="bold" className="w-3.5 h-3.5" />
                                </button>
                            ) : (
                                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-micro font-bold normal-case tracking-normal ${STATUS_TONE[e.status]}`}>
                                    {t(e.status === 'approved' ? 'timeoff.approved' : 'timeoff.declined')}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {open && (
                <RequestModal
                    members={members}
                    selfId={selfId}
                    orgId={orgId}
                    managerMode={managerMode}
                    onClose={() => setOpen(false)}
                />
            )}
        </section>
    );
}
