import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { HandGrabbingIcon, PlusIcon, TrashIcon, CalendarPlusIcon } from '@phosphor-icons/react';
import type { Location, User } from '@shared/types';
import { Button } from '@shared/components/Button';
import { Select } from '@shared/components/Select';
import { DatePicker } from '@shared/components/DatePicker';
import { TimePicker } from '@shared/components/TimePicker';
import { Input } from '@shared/components/Input';
import { FormError } from '@shared/components/FormError';
import { Modal, ConfirmDialog } from '@features/admin/components/Modal';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { toast } from '@shared/toast/toastStore';
import { formatTime, weekdayShort } from '@shared/utils/date';
import { buildShiftDates } from '@features/timesheets/shiftTimes';
import { scheduleService } from '../scheduleService';
import { useOpenShifts } from './useOpenShifts';
import type { OpenShift, OpenShiftInput } from './types';

/**
 * --- OPEN SHIFTS ---
 * Managers post a shift nobody is assigned to yet; members claim it, first
 * come first served (enforced server-side). Once claimed, a manager moves it
 * into the rota with "Add to rota" (creates the scheduled shift for the
 * claimer and retires the open post). Members only see the card when there is
 * something to claim or a shift they hold.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const personName = (p: OpenShift['claimer']) => (p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username : '');

function PostOpenShiftDialog({
    locations,
    defaultLocationId,
    onClose,
    onSubmit,
}: {
    locations: Location[];
    defaultLocationId?: string | null;
    onClose: () => void;
    onSubmit: (input: OpenShiftInput) => Promise<unknown>;
}) {
    const t = useTranslation();
    const pickable = locations.filter((l) => !l.archived_at);
    const [locationId, setLocationId] = useState(defaultLocationId ?? pickable[0]?.id ?? '');
    const [date, setDate] = useState(todayISO);
    const [start, setStart] = useState('08:00');
    const [end, setEnd] = useState('16:00');
    const [role, setRole] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        if (!locationId) return setError(t('shiftEditor.noLocations'));
        const { startDate, endDate } = buildShiftDates(date, start, end);
        setBusy(true);
        setError(null);
        try {
            await onSubmit({
                location_id: locationId,
                starts_at: startDate.toISOString(),
                ends_at: endDate.toISOString(),
                role: role.trim() || null,
                note: note.trim() || null,
            });
            onClose();
        } catch {
            setError(t('open.error'));
            setBusy(false);
        }
    };

    return (
        <Modal title={t('open.post')} onClose={onClose}>
            <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <label className="text-label text-gray-400">{t('admin.colLocation')}</label>
                        <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                            {pickable.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.name}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-label text-gray-400">{t('overview.colDate')}</label>
                        <DatePicker value={date} onChange={setDate} aria-label={t('shiftEditor.shiftDate')} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-label text-gray-400">{t('shiftEditor.startTime')}</label>
                        <TimePicker value={start} onChange={setStart} aria-label={t('shiftEditor.startTime')} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-label text-gray-400">{t('shiftEditor.endTime')}</label>
                        <TimePicker value={end} onChange={setEnd} aria-label={t('shiftEditor.endTime')} />
                    </div>
                    {end <= start && <p className="col-span-2 -mt-1 text-micro text-amber-500">{t('shiftEditor.overnight')}</p>}
                </div>
                <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder={t('open.roleOptional')} maxLength={40} />
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('schedule.notePlaceholder')} maxLength={160} />
                <FormError message={error} />
                <div className="flex gap-2 pt-1">
                    <Button variant="secondary" fullWidth onClick={onClose} disabled={busy}>
                        {t('common.cancel')}
                    </Button>
                    <Button fullWidth loading={busy} onClick={() => void submit()}>
                        {t('open.post')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export function OpenShiftsCard({ user, locations, canManage }: { user: User; locations: Location[]; canManage: boolean }) {
    const t = useTranslation();
    const qc = useQueryClient();
    const { list, create, claim, release, remove } = useOpenShifts(user);
    const [posting, setPosting] = useState(false);
    const [deleting, setDeleting] = useState<OpenShift | null>(null);
    const [promoting, setPromoting] = useState<string | null>(null);
    // Snapshot of "now" for this mount — past posts simply drop off on the next visit.
    const [now] = useState(() => Date.now());

    const items = (list.data ?? []).filter((o) => new Date(o.ends_at).getTime() > now);
    const relevant = canManage ? items : items.filter((o) => !o.claimed_by || o.claimed_by === user.id);
    if (!canManage && relevant.length === 0) return null;

    const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? '—';

    /** Claimed → a real rota entry for the claimer; the open post is retired. */
    const addToRota = async (o: OpenShift) => {
        if (!o.claimed_by) return;
        setPromoting(o.id);
        try {
            await scheduleService.createMany(
                user.organization_id,
                user.id,
                [{ user_id: o.claimed_by, starts_at: o.starts_at, ends_at: o.ends_at, all_day: false }],
                { location_id: o.location_id, note: o.note ?? null },
            );
            await remove.mutateAsync(o.id);
            qc.invalidateQueries({ queryKey: ['schedule'] });
            toast(t('open.addedToRota'), 'success');
        } catch (err) {
            toast(err instanceof Error && err.message === 'SCHEDULE_OVERLAP' ? t('schedule.overlap') : t('open.error'), 'error');
        } finally {
            setPromoting(null);
        }
    };

    return (
        <section className="glass rounded-2xl p-3">
            <header className="flex items-start justify-between gap-3 px-1">
                <div className="min-w-0">
                    <h2 className="flex items-center gap-1.5 text-card-title text-ink dark:text-white">
                        {t('open.title')}
                        {relevant.some((o) => !o.claimed_by) && (
                            <span className="rounded-full bg-emerald-500/12 px-1.5 text-[11px] font-semibold leading-5 tabular-nums text-emerald-700 dark:text-emerald-300">
                                {relevant.filter((o) => !o.claimed_by).length}
                            </span>
                        )}
                    </h2>
                    <p className="mt-0.5 text-caption text-ink-soft dark:text-slate-400">{t('open.hint')}</p>
                </div>
                {canManage && (
                    <Button size="sm" variant="tonal" icon={PlusIcon} onClick={() => setPosting(true)}>
                        {t('open.post')}
                    </Button>
                )}
            </header>

            {relevant.length === 0 ? (
                <p className="mt-2 px-1 text-meta text-ink-soft dark:text-slate-400">{t('open.empty')}</p>
            ) : (
                <ul className="mt-2.5 space-y-1">
                    {relevant.map((o) => {
                        const d = new Date(o.starts_at);
                        const mine = o.claimed_by === user.id;
                        return (
                            <li key={o.id} className="flex flex-wrap items-center gap-2.5 rounded-xl bg-white/55 p-1.5 ring-1 ring-ink/5 dark:bg-white/4 dark:ring-white/6">
                                <span className="flex h-9 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-emerald-500/10">
                                    <span className="text-[13px] font-bold leading-none tabular-nums text-emerald-800 dark:text-emerald-200">{d.getDate()}</span>
                                    <span className="mt-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-emerald-700/70 dark:text-emerald-300/70">
                                        {weekdayShort(d)}
                                    </span>
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-meta font-semibold text-ink dark:text-white">
                                        {locationName(o.location_id)}
                                        {o.role && <span className="font-medium text-ink-soft dark:text-slate-400"> · {o.role}</span>}
                                    </span>
                                    <span className="block truncate text-caption tabular-nums text-ink-soft dark:text-slate-400">
                                        {formatTime(o.starts_at)}–{formatTime(o.ends_at)}
                                        {o.note ? ` · ${o.note}` : ''}
                                    </span>
                                </span>

                                <span className="ml-auto flex shrink-0 items-center gap-1">
                                    {!o.claimed_by && !canManage && (
                                        <Button size="sm" variant="tonal" icon={HandGrabbingIcon} loading={claim.isPending && claim.variables === o.id} onClick={() => claim.mutate(o.id)}>
                                            {t('open.claim')}
                                        </Button>
                                    )}
                                    {mine && (
                                        <>
                                            <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">{t('open.yours')}</span>
                                            {!canManage && (
                                                <Button size="sm" variant="ghost" onClick={() => release.mutate(o.id)}>
                                                    {t('open.release')}
                                                </Button>
                                            )}
                                        </>
                                    )}
                                    {canManage && o.claimed_by && (
                                        <>
                                            {!mine && <span className="max-w-36 truncate text-caption text-ink-soft dark:text-slate-400">{t('open.claimedBy', { name: personName(o.claimer) })}</span>}
                                            <Button size="sm" variant="tonal" icon={CalendarPlusIcon} loading={promoting === o.id} onClick={() => void addToRota(o)}>
                                                {t('open.toRota')}
                                            </Button>
                                        </>
                                    )}
                                    {canManage && (
                                        <button
                                            type="button"
                                            onClick={() => setDeleting(o)}
                                            title={t('open.deleteTitle')}
                                            aria-label={t('open.deleteTitle')}
                                            className="flex size-7 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:text-slate-400"
                                        >
                                            <TrashIcon weight="bold" className="size-3.5" />
                                        </button>
                                    )}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}

            <AnimatePresence>
                {posting && (
                    <PostOpenShiftDialog
                        locations={locations}
                        onClose={() => setPosting(false)}
                        onSubmit={(input) => create.mutateAsync(input)}
                    />
                )}
                {deleting && (
                    <ConfirmDialog
                        title={t('open.deleteTitle')}
                        message={t('open.deleteConfirm')}
                        onClose={() => setDeleting(null)}
                        onConfirm={() => remove.mutateAsync(deleting.id)}
                    />
                )}
            </AnimatePresence>
        </section>
    );
}
