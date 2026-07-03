import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, FilePdfIcon, FileXlsIcon } from '@phosphor-icons/react';

import { useAuthContext } from '@features/auth/AuthContext';
import { useShiftContext } from '@features/shifts/ShiftContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { Button } from '@shared/components/Button';
import { DataTable, type Column } from '@shared/components/DataTable';
import { MonthPicker } from '@shared/components/MonthPicker';
import { Skeleton } from '@shared/components/Skeleton';
import { ConfirmDialog } from '@features/admin/components/Modal';
import { timesheetService } from '@features/timesheets/timesheetService';
import { formatTime, weekdayShort } from '@shared/utils/date';
import type { ScheduledShift } from '@shared/types';
import { scheduleService, type ScheduledInput } from './scheduleService';
import { ScheduledShiftEditor } from './components/ScheduledShiftEditor';
import { exportSchedule, type ExportScheduleRow } from './exportSchedule';

function monthStartFromKey(monthKey: string): Date {
    const [year, month] = monthKey.split('-').map(Number);
    const d = new Date(year, month - 1, 1);
    d.setHours(0, 0, 0, 0);
    return d;
}

function monthKeyFromDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(date: Date): string {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function SchedulePage() {
    const { user } = useAuthContext();
    const { locations } = useShiftContext();
    const t = useTranslation();
    const qc = useQueryClient();

    const canManage = (user?.role.rank ?? 0) >= 20;

    const [selectedMonth, setSelectedMonth] = useState(() => monthKeyFromDate(new Date()));
    const [activeTab, setActiveTab] = useState<'mine' | 'team'>(canManage ? 'team' : 'mine');
    const [editing, setEditing] = useState<{ shift: ScheduledShift | null; date: string } | null>(null);
    const [deleting, setDeleting] = useState<ScheduledShift | null>(null);

    const monthStart = useMemo(() => monthStartFromKey(selectedMonth), [selectedMonth]);
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

    if (!user) return null;

    const locationName = (id: string | null) => (id ? locations.find((l) => l.id === id)?.name ?? '—' : '—');
    const memberName = (s: ScheduledShift) =>
        `${s.profiles?.first_name ?? ''} ${s.profiles?.last_name ?? ''}`.trim() || s.profiles?.username || '—';

    const shifts = scheduleQ.data ?? [];
    const myShifts = shifts.filter((shift) => shift.user_id === user.id);
    const visibleShifts = activeTab === 'team' && canManage ? shifts : myShifts;

    const tableRows: ExportScheduleRow[] = visibleShifts.map((shift) => {
        const startsAt = new Date(shift.starts_at);
        return {
            date: startsAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
            day: weekdayShort(startsAt),
            member: memberName(shift),
            location: locationName(shift.location_id),
            start: formatTime(shift.starts_at),
            end: formatTime(shift.ends_at),
            note: shift.note ?? '',
        };
    });

    const exportContext = {
        title: activeTab === 'team' && canManage ? t('schedule.exportTitleTeam') : t('schedule.exportTitleMine'),
        periodLabel: formatMonthLabel(monthStart),
        rows: tableRows,
        labels: {
            title: activeTab === 'team' && canManage ? t('schedule.exportTitleTeam') : t('schedule.exportTitleMine'),
            period: t('export.period'),
            generatedOn: t('export.generatedOn'),
            colDate: t('schedule.colDate'),
            colDay: t('schedule.colDay'),
            colMember: t('schedule.colMember'),
            colLocation: t('schedule.colLocation'),
            colStart: t('schedule.colStart'),
            colEnd: t('schedule.colEnd'),
            colNote: t('schedule.colNote'),
        },
    };

    const doExport = async (format: 'pdf' | 'excel') => {
        await exportSchedule(format, exportContext);
    };

    const columns = useMemo<Column<ExportScheduleRow>[]>(
        () => {
            const base: Column<ExportScheduleRow>[] = [
                {
                    key: 'date',
                    header: t('schedule.colDate'),
                    render: (row) => row.date,
                    width: 'w-24',
                },
                {
                    key: 'day',
                    header: t('schedule.colDay'),
                    render: (row) => row.day,
                    width: 'w-20 sm:w-24',
                    hideOnMobile: true,
                },
                {
                    key: 'location',
                    header: t('schedule.colLocation'),
                    render: (row) => row.location,
                    width: 'w-[22%] sm:w-[24%]',
                },
                {
                    key: 'start',
                    header: t('schedule.colStart'),
                    render: (row) => row.start,
                    width: 'w-16',
                    align: 'center',
                },
                {
                    key: 'end',
                    header: t('schedule.colEnd'),
                    render: (row) => row.end,
                    width: 'w-16',
                    align: 'center',
                },
                {
                    key: 'note',
                    header: t('schedule.colNote'),
                    render: (row) => row.note || '—',
                },
            ];

            if (canManage && activeTab === 'team') {
                return [
                    base[0],
                    base[1],
                    {
                        key: 'member',
                        header: t('schedule.colMember'),
                        render: (row) => row.member ?? '—',
                        width: 'w-[24%]',
                    },
                    base[2],
                    base[3],
                    base[4],
                    base[5],
                ];
            }

            return base;
        },
        [activeTab, canManage, t],
    );

    const emptyState = (
        <div className="rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-8 text-center">
            <p className="text-body-strong text-gray-900 dark:text-white">{t('schedule.noShiftsMonth')}</p>
            <p className="mt-2 text-caption text-gray-500 dark:text-gray-400">{t('schedule.emptyHintMonth')}</p>
        </div>
    );

    return (
        <div className="space-y-4 px-1 pb-10">
            <header className="pt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-0.5">
                    <p className="text-label text-emerald-500 text-left">{canManage ? t('schedule.roster') : t('schedule.mine')}</p>
                    <h1 className="text-display text-gray-900 dark:text-white">{t('nav.schedule')}</h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" icon={FileXlsIcon} onClick={() => doExport('excel')}>
                        {t('schedule.exportExcel')}
                    </Button>
                    <Button size="sm" variant="secondary" icon={FilePdfIcon} onClick={() => doExport('pdf')}>
                        {t('schedule.exportPdf')}
                    </Button>
                    {canManage && (
                        <Button size="sm" icon={PlusIcon} onClick={() => setEditing({ shift: null, date: monthKeyFromDate(monthStart) })}>
                            {t('schedule.add')}
                        </Button>
                    )}
                </div>
            </header>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] items-center">
                <MonthPicker value={selectedMonth} onChange={(value) => setSelectedMonth(value ?? monthKeyFromDate(new Date()))} />

                {canManage && (
                    <div className="inline-flex rounded-2xl bg-gray-100 dark:bg-gray-800/40 p-1 shadow-sm">
                        <button
                            type="button"
                            onClick={() => setActiveTab('team')}
                            className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${activeTab === 'team' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            {t('schedule.tabTeam')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('mine')}
                            className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${activeTab === 'mine' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            {t('schedule.tabMine')}
                        </button>
                    </div>
                )}
            </div>

            <section className="grid gap-3">
                <div className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-4 shadow-sm sm:flex sm:items-center sm:justify-between">
                    <div>
                        <p className="text-caption text-gray-500 dark:text-gray-400">{t('schedule.periodLabel', { month: formatMonthLabel(monthStart) })}</p>
                        <p className="mt-1 text-body-strong text-gray-900 dark:text-white">
                            {canManage && activeTab === 'team' ? t('schedule.tabTeam') : t('schedule.tabMine')}
                        </p>
                    </div>
                    <div className="rounded-3xl bg-gray-50 dark:bg-gray-800/70 px-3 py-2 text-caption text-gray-500 dark:text-gray-400">
                        {visibleShifts.length} {t('schedule.shiftsCount')}
                    </div>
                </div>

                {scheduleQ.isLoading ? (
                    <div className="space-y-2" aria-hidden>
                        {[0, 1, 2, 3].map((index) => (
                            <Skeleton key={index} className="h-16 rounded-2xl" />
                        ))}
                    </div>
                ) : (
                    <DataTable
                        columns={columns}
                        rows={tableRows}
                        rowKey={(row) => `${row.date}-${row.start}-${row.end}-${row.location}-${row.member ?? ''}`}
                        emptyState={emptyState}
                    />
                )}
            </section>

            <AnimatePresence>
                {editing && canManage && (
                    <ScheduledShiftEditor
                        members={membersQ.data ?? []}
                        locations={locations}
                        shift={editing.shift}
                        defaultDate={editing.date}
                        onClose={() => setEditing(null)}
                        onSubmit={async (values) => {
                            if (editing.shift) await updateM.mutateAsync({ id: editing.shift.id, v: values });
                            else await createM.mutateAsync(values);
                        }}
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
