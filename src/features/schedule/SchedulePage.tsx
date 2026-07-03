import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, FilePdfIcon, FileXlsIcon, CaretDownIcon, MapPinIcon } from '@phosphor-icons/react';

import { useAuthContext } from '@features/auth/AuthContext';
import { useShiftContext } from '@features/shifts/ShiftContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { Button } from '@shared/components/Button';
import { MonthPicker } from '@shared/components/MonthPicker';
import { Skeleton } from '@shared/components/Skeleton';
import { ConfirmDialog } from '@features/admin/components/Modal';
import { timesheetService } from '@features/timesheets/timesheetService';
import type { ScheduledShift } from '@shared/types';
import { scheduleService, type ScheduledInput } from './scheduleService';
import { ScheduledShiftEditor } from './components/ScheduledShiftEditor';
import { MonthCalendar } from './components/MonthCalendar';
import { exportSchedule, type ScheduleExportSection } from './exportSchedule';

/**
 * --- SCHEDULE PAGE (rota) ---
 * A real month calendar per location: managers walk the location list and
 * assign people by clicking a day; members get a single read-only calendar of
 * their own shifts. Exports the same structure as a printable PDF (calendar
 * page per location) or an Excel workbook (sheet per location).
 */

const pad = (n: number) => String(n).padStart(2, '0');
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export default function SchedulePage() {
    const { user } = useAuthContext();
    const { locations } = useShiftContext();
    const t = useTranslation();
    const qc = useQueryClient();

    const canManage = (user?.role.rank ?? 0) >= 20;

    const [selectedMonth, setSelectedMonth] = useState(() => monthKeyOf(new Date()));
    const [activeTab, setActiveTab] = useState<'mine' | 'team'>(canManage ? 'team' : 'mine');
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [editing, setEditing] = useState<{ shift: ScheduledShift | null; date: string; locationId?: string | null } | null>(null);
    const [deleting, setDeleting] = useState<ScheduledShift | null>(null);

    const monthStart = useMemo(() => {
        const [y, m] = selectedMonth.split('-').map(Number);
        return new Date(y, m - 1, 1);
    }, [selectedMonth]);
    const monthEnd = useMemo(() => {
        const d = new Date(monthStart);
        d.setMonth(d.getMonth() + 1);
        return d;
    }, [monthStart]);

    const scheduleQ = useQuery({
        queryKey: ['schedule', selectedMonth],
        queryFn: () => scheduleService.getRange(monthStart.toISOString(), monthEnd.toISOString()),
        enabled: !!user,
    });

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

    const shifts = useMemo(() => scheduleQ.data ?? [], [scheduleQ.data]);
    const teamView = canManage && activeTab === 'team';

    // Team view: one calendar section per active location (keep archived ones
    // that still hold shifts this month), plus a "no location" bucket.
    const sections = useMemo(() => {
        if (!teamView) return [];
        const withShifts = new Set(shifts.map((s) => s.location_id));
        const visible = locations
            .filter((l) => !l.archived_at || withShifts.has(l.id))
            .sort((a, b) => a.name.localeCompare(b.name));
        const list = visible.map((l) => ({
            id: l.id as string | null,
            name: l.name,
            items: shifts.filter((s) => s.location_id === l.id),
        }));
        const unassigned = shifts.filter((s) => !s.location_id);
        if (unassigned.length > 0) list.push({ id: null, name: t('schedule.noLocation'), items: unassigned });
        return list;
    }, [teamView, locations, shifts, t]);

    if (!user) return null;

    const myShifts = shifts.filter((s) => s.user_id === user.id);
    const locationName = (id: string | null) => (id ? locations.find((l) => l.id === id)?.name ?? '—' : t('schedule.noLocation'));
    const memberShort = (s: ScheduledShift) => {
        const first = s.profiles?.first_name;
        const last = s.profiles?.last_name;
        if (first) return last ? `${first} ${last[0]}.` : first;
        return s.profiles?.username ?? '—';
    };
    const memberFull = (s: ScheduledShift) =>
        `${s.profiles?.first_name ?? ''} ${s.profiles?.last_name ?? ''}`.trim() || s.profiles?.username || '—';

    const periodLabel = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const toggleSection = (key: string) =>
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    const doExport = async (format: 'pdf' | 'excel') => {
        const exportSections: ScheduleExportSection[] = teamView
            ? sections.map((sec) => ({ name: sec.name, shifts: sec.items, label: memberFull }))
            : [{ name: t('schedule.exportTitleMine'), shifts: myShifts, label: (s) => locationName(s.location_id) }];
        await exportSchedule(format, {
            monthKey: selectedMonth,
            periodLabel,
            sections: exportSections,
            labels: {
                title: teamView ? t('schedule.exportTitleTeam') : t('schedule.exportTitleMine'),
                period: t('export.period'),
                generatedOn: t('export.generatedOn'),
                colDate: t('schedule.colDate'),
                colDay: t('schedule.colDay'),
                colMember: teamView ? t('schedule.colMember') : t('schedule.colLocation'),
                colStart: t('schedule.colStart'),
                colEnd: t('schedule.colEnd'),
                colNote: t('schedule.colNote'),
            },
        });
    };

    const hasAnything = teamView ? shifts.length > 0 : myShifts.length > 0;
    const cardClass = 'rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/40 shadow-sm overflow-hidden';

    return (
        <div className="space-y-4 px-1 pb-10">
            <header className="pt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-0.5">
                    <p className="text-label text-emerald-500 text-left">{canManage ? t('schedule.roster') : t('schedule.mine')}</p>
                    <h1 className="text-display text-gray-900 dark:text-white">{t('nav.schedule')}</h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="secondary" icon={FileXlsIcon} disabled={!hasAnything} onClick={() => doExport('excel')}>
                        Excel
                    </Button>
                    <Button size="sm" variant="secondary" icon={FilePdfIcon} disabled={!hasAnything} onClick={() => doExport('pdf')}>
                        PDF
                    </Button>
                    {canManage && (
                        <Button size="sm" icon={PlusIcon} onClick={() => setEditing({ shift: null, date: `${selectedMonth}-01` })}>
                            {t('schedule.add')}
                        </Button>
                    )}
                </div>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <MonthPicker value={selectedMonth} onChange={(v) => setSelectedMonth(v ?? monthKeyOf(new Date()))} />

                {canManage && (
                    <div className="inline-flex rounded-2xl bg-gray-100 dark:bg-gray-800/40 p-1 shadow-sm">
                        {(['team', 'mine'] as const).map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                className={`rounded-xl px-3 py-1.5 text-small-strong transition-colors ${
                                    activeTab === tab
                                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                {tab === 'team' ? t('schedule.tabTeam') : t('schedule.tabMine')}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {scheduleQ.isLoading ? (
                <div className="space-y-3" aria-hidden>
                    {[0, 1].map((i) => (
                        <Skeleton key={i} className="h-56 rounded-3xl" />
                    ))}
                </div>
            ) : teamView ? (
                <div className="space-y-3">
                    {sections.map((sec) => {
                        const key = sec.id ?? 'none';
                        const isOpen = !collapsed.has(key);
                        return (
                            <section key={key} className={cardClass}>
                                <button
                                    type="button"
                                    onClick={() => toggleSection(key)}
                                    aria-expanded={isOpen}
                                    className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                        <MapPinIcon weight="fill" className="w-4 h-4" />
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-body-strong text-gray-900 dark:text-white truncate">{sec.name}</span>
                                        <span className="block text-caption text-gray-400">
                                            {sec.items.length} {t('schedule.shiftsCount')}
                                        </span>
                                    </span>
                                    <CaretDownIcon
                                        weight="bold"
                                        className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                {isOpen && (
                                    <MonthCalendar
                                        monthKey={selectedMonth}
                                        shifts={sec.items}
                                        chipLabel={memberShort}
                                        canManage
                                        onDayClick={(date) => setEditing({ shift: null, date, locationId: sec.id })}
                                        onShiftClick={(s) => setEditing({ shift: s, date: s.starts_at.slice(0, 10), locationId: s.location_id })}
                                    />
                                )}
                            </section>
                        );
                    })}
                </div>
            ) : (
                <section className={cardClass}>
                    <MonthCalendar
                        monthKey={selectedMonth}
                        shifts={myShifts}
                        chipLabel={(s) => locationName(s.location_id)}
                        canManage={false}
                    />
                    {myShifts.length === 0 && (
                        <p className="px-4 pb-4 text-center text-caption text-gray-400">{t('schedule.noShiftsMonth')}</p>
                    )}
                </section>
            )}

            <AnimatePresence>
                {editing && canManage && (
                    <ScheduledShiftEditor
                        members={membersQ.data ?? []}
                        locations={locations}
                        shift={editing.shift}
                        defaultDate={editing.date}
                        defaultLocationId={editing.locationId}
                        onClose={() => setEditing(null)}
                        onSubmit={async (values) => {
                            if (editing.shift) await updateM.mutateAsync({ id: editing.shift.id, v: values });
                            else await createM.mutateAsync(values);
                        }}
                        onDelete={
                            editing.shift
                                ? () => {
                                      setDeleting(editing.shift);
                                      setEditing(null);
                                  }
                                : undefined
                        }
                    />
                )}
                {deleting && (
                    <ConfirmDialog
                        title={t('schedule.deleteTitle')}
                        message={t('schedule.deleteConfirm')}
                        onClose={() => setDeleting(null)}
                        onConfirm={async () => {
                            await deleteM.mutateAsync(deleting.id);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
