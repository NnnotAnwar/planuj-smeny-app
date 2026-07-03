import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CaretLeftIcon, CaretRightIcon, PlusIcon, MapPinIcon } from '@phosphor-icons/react';

import { useAuthContext } from '@features/auth/AuthContext';
import { useShiftContext } from '@features/shifts/ShiftContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { Button } from '@shared/components/Button';
import { Skeleton } from '@shared/components/Skeleton';
import { ActionButtons } from '@features/admin/components/ActionButtons';
import { ConfirmDialog } from '@features/admin/components/Modal';
import { timesheetService } from '@features/timesheets/timesheetService';
import { formatTime, weekdayShort, monthShort } from '@shared/utils/date';
import type { ScheduledShift } from '@shared/types';
import { scheduleService, type ScheduledInput } from './scheduleService';
import { ScheduledShiftEditor, type ScheduledFormValues } from './components/ScheduledShiftEditor';

/** Monday 00:00 (local) of the week containing `d`. */
function startOfWeek(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    const dow = (x.getDay() + 6) % 7; // 0 = Monday
    x.setDate(x.getDate() - dow);
    return x;
}

export default function SchedulePage() {
    const { user } = useAuthContext();
    const { locations } = useShiftContext();
    const t = useTranslation();
    const qc = useQueryClient();

    const canManage = (user?.role.rank ?? 0) >= 20;

    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
    const weekEnd = useMemo(() => {
        const e = new Date(weekStart);
        e.setDate(e.getDate() + 7);
        return e;
    }, [weekStart]);

    // Editor / delete dialog state.
    const [editing, setEditing] = useState<{ shift: ScheduledShift | null; date: string } | null>(null);
    const [deleting, setDeleting] = useState<ScheduledShift | null>(null);

    const startISO = weekStart.toISOString();
    const endISO = weekEnd.toISOString();

    const scheduleQ = useQuery({
        queryKey: ['schedule', startISO],
        queryFn: () => scheduleService.getRange(startISO, endISO),
        enabled: !!user,
    });

    // Managers need the member list for the editor's "who" picker.
    const membersQ = useQuery({
        queryKey: ['schedule-members'],
        queryFn: () => timesheetService.getMembers(),
        enabled: canManage,
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ['schedule'] });
    const createM = useMutation({
        mutationFn: (v: ScheduledInput) => scheduleService.create(user!.organization_id, user!.id, v),
        onSuccess: invalidate,
    });
    const updateM = useMutation({
        mutationFn: ({ id, v }: { id: string; v: ScheduledInput }) => scheduleService.update(id, v),
        onSuccess: invalidate,
    });
    const deleteM = useMutation({ mutationFn: (id: string) => scheduleService.remove(id), onSuccess: invalidate });

    // Seven day buckets (Mon→Sun), each with its shifts. Computed before any
    // early return so the Hook order stays stable.
    const days = useMemo(() => {
        const shifts = scheduleQ.data ?? [];
        return Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            const key = d.toDateString();
            return { date: d, items: shifts.filter((s) => new Date(s.starts_at).toDateString() === key) };
        });
    }, [weekStart, scheduleQ.data]);

    if (!user) return null;

    const locationName = (id: string | null) => (id ? locations.find((l) => l.id === id)?.name ?? '—' : '—');
    const memberName = (s: ScheduledShift) =>
        `${s.profiles?.first_name ?? ''} ${s.profiles?.last_name ?? ''}`.trim() || s.profiles?.username || '—';

    const weekLabel = `${weekStart.getDate()} ${monthShort(weekStart)} – ${new Date(weekEnd.getTime() - 1).getDate()} ${monthShort(new Date(weekEnd.getTime() - 1))}`;
    const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const submitEditor = async (values: ScheduledFormValues) => {
        if (editing?.shift) await updateM.mutateAsync({ id: editing.shift.id, v: values });
        else await createM.mutateAsync(values);
    };

    return (
        <div className="space-y-4 px-1 pb-10">
            <header className="pt-2 flex items-end justify-between gap-3">
                <div className="space-y-0.5">
                    <p className="text-label text-emerald-500 text-left">{canManage ? t('schedule.roster') : t('schedule.mine')}</p>
                    <h1 className="text-display text-gray-900 dark:text-white">{t('nav.schedule')}</h1>
                </div>
                {canManage && (
                    <Button size="sm" icon={PlusIcon} onClick={() => setEditing({ shift: null, date: isoDate(new Date()) })}>
                        {t('schedule.add')}
                    </Button>
                )}
            </header>

            {/* Week navigator */}
            <div className="flex items-center justify-between gap-2 bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-2xl px-2 py-1.5 shadow-sm">
                <button
                    onClick={() => setWeekStart((w) => { const n = new Date(w); n.setDate(n.getDate() - 7); return n; })}
                    aria-label={t('schedule.prevWeek')}
                    className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 active:scale-90 transition-all"
                >
                    <CaretLeftIcon weight="bold" className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setWeekStart(startOfWeek(new Date()))}
                    className="flex-1 text-center text-body-strong text-gray-900 dark:text-white"
                >
                    {weekLabel}
                </button>
                <button
                    onClick={() => setWeekStart((w) => { const n = new Date(w); n.setDate(n.getDate() + 7); return n; })}
                    aria-label={t('schedule.nextWeek')}
                    className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 active:scale-90 transition-all"
                >
                    <CaretRightIcon weight="bold" className="w-4 h-4" />
                </button>
            </div>

            {/* Days */}
            {scheduleQ.isLoading ? (
                <div className="space-y-2" aria-hidden>
                    {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
                </div>
            ) : (
                <div className="space-y-2">
                    {days.map(({ date, items }) => {
                        const isToday = date.toDateString() === new Date().toDateString();
                        return (
                            <section key={date.toISOString()} className="bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
                                <div className={`flex items-center justify-between px-4 py-2 border-b border-gray-50 dark:border-gray-800 ${isToday ? 'bg-emerald-50/60 dark:bg-emerald-900/10' : ''}`}>
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-body-strong ${isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                                            {weekdayShort(date)}
                                        </span>
                                        <span className="text-caption text-gray-400">{date.getDate()} {monthShort(date)}</span>
                                    </div>
                                    {canManage && (
                                        <button
                                            onClick={() => setEditing({ shift: null, date: isoDate(date) })}
                                            aria-label={t('schedule.add')}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                                        >
                                            <PlusIcon weight="bold" className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {items.length === 0 ? (
                                    <p className="px-4 py-3 text-caption text-gray-400">{t('schedule.empty')}</p>
                                ) : (
                                    <ul className="divide-y divide-gray-50 dark:divide-gray-800/50">
                                        {items.map((s) => (
                                            <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-small-strong text-gray-900 dark:text-white truncate">
                                                        {formatTime(s.starts_at)}–{formatTime(s.ends_at)}
                                                        {canManage && <span className="text-gray-500 dark:text-gray-400 font-normal"> · {memberName(s)}</span>}
                                                    </p>
                                                    <p className="text-caption text-gray-400 flex items-center gap-1 truncate">
                                                        <MapPinIcon weight="fill" className="w-3 h-3 text-emerald-500 shrink-0" />
                                                        {locationName(s.location_id)}
                                                        {s.note ? ` · ${s.note}` : ''}
                                                    </p>
                                                </div>
                                                {canManage && (
                                                    <ActionButtons
                                                        onEdit={() => setEditing({ shift: s, date: isoDate(new Date(s.starts_at)) })}
                                                        onDelete={() => setDeleting(s)}
                                                    />
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}

            {/* Editor modal (managers) */}
            <AnimatePresence>
                {editing && canManage && (
                    <ScheduledShiftEditor
                        members={membersQ.data ?? []}
                        locations={locations}
                        shift={editing.shift}
                        defaultDate={editing.date}
                        onClose={() => setEditing(null)}
                        onSubmit={submitEditor}
                    />
                )}
                {deleting && (
                    <ConfirmDialog
                        title={t('schedule.deleteTitle')}
                        message={t('schedule.deleteConfirm')}
                        onClose={() => setDeleting(null)}
                        onConfirm={async () => { await deleteM.mutateAsync(deleting.id); }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
