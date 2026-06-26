import { useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
    MagnifyingGlassIcon,
    CaretRightIcon,
    CaretLeftIcon,
    PlusIcon,
    DownloadSimpleIcon,
    UsersThreeIcon,
    FilePdfIcon,
    FileXlsIcon,
    FileCsvIcon,
    ClockUserIcon,
    type Icon,
} from '@phosphor-icons/react';

import { useAuthContext } from '@features/auth/AuthContext';
import { canViewAdminPanel, canManageMember } from '@shared/auth/permissions';
import { DataTable, type Column } from '@shared/components/DataTable';
import { MonthPicker } from '@shared/components/MonthPicker';
import { ActionButtons } from '@features/admin/components/ActionButtons';
import { ConfirmDialog } from '@features/admin/components/Modal';
import { UserProfileModal } from '@features/profile/components/UserProfileModal';
import { getRoleBadgeColor } from '@shared/utils/roleColors';
import { getFullInitials } from '@shared/utils/getInitials';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { type Shift, type Profile } from '@shared/types';
import { shiftHours, fmtHours, fmtDuration, shiftGrossHours, shiftBreakHours } from '@features/shifts/shiftStats';
import { formatClock } from '@shared/utils/date';

import { timesheetService } from './timesheetService';
import { exportShifts, exportAllShifts, type ExportFormat } from './exportShifts';
import { useTimesheetRealtime } from './useTimesheetRealtime';
import { ShiftEditorModal, type ShiftFormValues } from './components/ShiftEditorModal';

const EXPORT_FORMATS = [
    { fmt: 'pdf' as const, label: 'PDF', Icon: FilePdfIcon },
    { fmt: 'excel' as const, label: 'Excel', Icon: FileXlsIcon },
    { fmt: 'csv' as const, label: 'CSV', Icon: FileCsvIcon },
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function memberName(m: Profile): string {
    return [m.first_name, m.last_name].filter(Boolean).join(' ') || m.username;
}

function fmtTimeRange(s: Shift): string {
    const start = formatClock(s.started_at);
    const end = formatClock(s.ended_at);
    return `${start} – ${end}`;
}

/** Download button with a PDF/Excel/CSV dropdown, used for single + bulk export. */
function ExportMenu({
    open,
    setOpen,
    onPick,
    disabled,
    title,
    Icon: TriggerIcon,
    busy,
}: {
    open: boolean;
    setOpen: (v: boolean) => void;
    onPick: (fmt: ExportFormat) => void;
    disabled?: boolean;
    title: string;
    Icon: Icon;
    busy?: boolean;
}) {
    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                disabled={disabled}
                title={title}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-500/10 active:scale-90 transition-all disabled:opacity-40"
            >
                <TriggerIcon weight="bold" className={`w-4 h-4 ${busy ? 'animate-pulse' : ''}`} />
            </button>
            <AnimatePresence>
                {open && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 4, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                            className="absolute right-0 top-full z-50 w-44 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl p-1.5 overflow-hidden"
                        >
                            {EXPORT_FORMATS.map(({ fmt, label, Icon: FmtIcon }) => (
                                <button
                                    key={fmt}
                                    onClick={() => onPick(fmt)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-small text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    <FmtIcon weight="bold" className="w-4 h-4 text-emerald-500" />
                                    {label}
                                </button>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

/**
 * --- TIMESHEETS PAGE ---
 * Managers and above (rank >= 20) pick a member, review their shifts for a month
 * (or all-time), edit/add/delete them (when they out-rank the member), and
 * export the timesheet as PDF / Excel / CSV for signing. Every administrative
 * change is recorded in the Activity Log.
 */
export function TimesheetsPage() {
    const { user } = useAuthContext();
    if (user && !canViewAdminPanel(user)) return <Navigate to="/" replace />;
    return <TimesheetsInner />;
}

function TimesheetsInner() {
    const { user } = useAuthContext();
    const t = useTranslation();
    const qc = useQueryClient();
    useTimesheetRealtime();

    // Allow deep-linking a member (e.g. from the Activity Log: /timesheets?member=ID).
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('member'));
    const [search, setSearch] = useState('');
    const [month, setMonth] = useState<string | null>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [editing, setEditing] = useState<{ shift: Shift | null } | null>(null);
    const [deleting, setDeleting] = useState<Shift | null>(null);
    const [exportOpen, setExportOpen] = useState(false);
    const [exportAllOpen, setExportAllOpen] = useState(false);
    const [exportingAll, setExportingAll] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);

    const backToList = () => {
        setSelectedId(null);
        if (searchParams.has('member')) setSearchParams({}, { replace: true });
    };

    const membersQ = useQuery({
        queryKey: ['timesheets', 'members'],
        queryFn: () => timesheetService.getMembers(),
        enabled: !!user,
    });
    const members = membersQ.data ?? [];
    const selected = members.find((m) => m.id === selectedId) ?? null;

    const locationsQ = useQuery({
        queryKey: ['timesheets', 'locations', selected?.organization_id],
        queryFn: () => timesheetService.getOrgLocations(selected!.organization_id),
        enabled: !!selected,
    });
    const locations = useMemo(() => locationsQ.data ?? [], [locationsQ.data]);

    const shiftsQ = useQuery({
        queryKey: ['timesheets', 'shifts', selectedId],
        queryFn: () => timesheetService.getMemberShifts(selectedId!),
        enabled: !!selectedId,
    });

    const locationName = useMemo(() => {
        const map = new Map(locations.map((l) => [l.id, l.name]));
        return (id: string) => map.get(id) ?? t('common.unknown');
    }, [locations]);

    const shifts = useMemo(() => {
        const all = shiftsQ.data ?? [];
        return month ? all.filter((s) => s.started_at.startsWith(month)) : all;
    }, [shiftsQ.data, month]);

    const totals = useMemo(() => {
        let gross = 0;
        let net = 0;
        for (const s of shifts) {
            gross += shiftGrossHours(s);
            net += shiftHours(s);
        }
        return { gross, net, brk: gross - net, count: shifts.length };
    }, [shifts]);

    const canEdit = !!(user && selected && canManageMember(user, selected));
    // Period for the exported document — `YYYY-MM`, or all-time.
    const periodLabel = month ?? t('overview.allTime');

    const invalidate = () =>
        Promise.all([
            qc.invalidateQueries({ queryKey: ['timesheets', 'shifts', selectedId] }),
            qc.invalidateQueries({ queryKey: ['timesheets', 'audit'] }),
        ]);

    const filteredMembers = members.filter((m) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
            memberName(m).toLowerCase().includes(q) ||
            m.username.toLowerCase().includes(q) ||
            (m.email ?? '').toLowerCase().includes(q)
        );
    });

    const handleSubmit = async (values: ShiftFormValues) => {
        if (!selectedId) return;
        if (editing?.shift) {
            await timesheetService.updateShift(editing.shift.id, values);
        } else {
            await timesheetService.createShift({ user_id: selectedId, ...values });
        }
        await invalidate();
    };

    const handleDelete = async () => {
        if (!deleting) return;
        await timesheetService.deleteShift(deleting.id);
        await invalidate();
    };

    const doExport = (fmt: ExportFormat) => {
        if (!selected) return;
        exportShifts(fmt, { employeeName: memberName(selected), periodLabel, shifts, locationName });
        setExportOpen(false);
    };

    // Export every member's timesheet for the selected period in one document.
    const doExportAll = async (fmt: ExportFormat) => {
        setExportAllOpen(false);
        setExportingAll(true);
        try {
            const [allShifts, allLocations] = await Promise.all([
                timesheetService.getMonthShifts(month),
                timesheetService.getAllLocations(),
            ]);
            const locMap = new Map(allLocations.map((l) => [l.id, l.name]));
            const byUser = new Map<string, Shift[]>();
            for (const s of allShifts) {
                const arr = byUser.get(s.user_id) ?? [];
                arr.push(s);
                byUser.set(s.user_id, arr);
            }
            const groups = members
                .map((m) => ({ employeeName: memberName(m), shifts: byUser.get(m.id) ?? [] }))
                .filter((g) => g.shifts.length > 0)
                .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

            await exportAllShifts(fmt, {
                periodLabel,
                locationName: (id) => locMap.get(id) ?? t('common.unknown'),
                groups,
            });
        } finally {
            setExportingAll(false);
        }
    };

    // -----------------------------------------------------------------
    // Shift table columns
    // -----------------------------------------------------------------
    const columns: Column<Shift>[] = [
        {
            key: 'date',
            header: t('overview.colDate'),
            width: 'w-16 sm:w-24',
            className: 'whitespace-nowrap',
            footer: <span className="text-label text-gray-400">{t('overview.total')}</span>,
            render: (s) => {
                const d = new Date(s.started_at);
                return (
                    <div className="flex flex-col">
                        <span className="text-small-strong dark:text-white">
                            {d.getDate()} {d.toLocaleDateString(undefined, { month: 'short' })}
                        </span>
                        <span className="text-micro text-gray-400">{WEEKDAYS[(d.getDay() + 6) % 7]}</span>
                    </div>
                );
            },
        },
        {
            key: 'location',
            header: t('overview.colLocationTime'),
            className: 'w-full',
            footer: (
                <span className="sm:hidden text-caption text-gray-500 dark:text-gray-400 tabular-nums">
                    {fmtHours(totals.gross)} · −{fmtHours(totals.brk)}
                </span>
            ),
            render: (s) => {
                const gross = shiftGrossHours(s);
                const brk = shiftBreakHours(s);
                return (
                    <div className="flex flex-col min-w-0">
                        <span className="text-small-strong text-gray-700 dark:text-gray-200 truncate">{locationName(s.location_id)}</span>
                        <span className="text-caption text-gray-400 tabular-nums">{fmtTimeRange(s)}</span>
                        <span className="sm:hidden text-caption text-gray-400 tabular-nums">
                            Gross {fmtDuration(gross)}{brk > 0 ? ` · −${fmtDuration(brk)}` : ''}
                        </span>
                    </div>
                );
            },
        },
        {
            key: 'gross',
            header: t('overview.colGross'),
            align: 'right',
            width: 'w-20',
            hideOnMobile: true,
            className: 'text-xs font-bold tabular-nums text-gray-600 dark:text-gray-300',
            footer: <span className="text-xs font-black tabular-nums dark:text-white">{fmtHours(totals.gross)}</span>,
            render: (s) => fmtDuration(shiftGrossHours(s)),
        },
        {
            key: 'break',
            header: t('overview.colBreak'),
            align: 'right',
            width: 'w-20',
            hideOnMobile: true,
            className: 'text-xs font-bold tabular-nums text-amber-500',
            footer: <span className="text-xs font-black tabular-nums text-amber-500">-{fmtHours(totals.brk)}</span>,
            render: (s) => {
                const brk = shiftBreakHours(s);
                return brk > 0 ? `-${fmtDuration(brk)}` : '—';
            },
        },
        {
            key: 'net',
            header: t('overview.colNet'),
            align: 'right',
            width: canEdit ? 'w-16 sm:w-20' : 'w-20 sm:w-24',
            footer: <span className="text-xs font-black tabular-nums whitespace-nowrap text-emerald-600 dark:text-emerald-400">{fmtHours(totals.net)}</span>,
            render: (s) => {
                const ongoing = !s.ended_at;
                return (
                    <>
                        <span className={`block text-xs font-black tabular-nums whitespace-nowrap ${ongoing ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {fmtDuration(shiftHours(s))}
                        </span>
                        {ongoing && <span className="block text-micro text-amber-500">{t('overview.live')}</span>}
                    </>
                );
            },
        },
        ...(canEdit
            ? [
                  {
                      key: 'actions',
                      header: '',
                      align: 'right' as const,
                      width: 'w-16 sm:w-24',
                      render: (s: Shift) => (
                          <div className="flex justify-end">
                              <ActionButtons onEdit={() => setEditing({ shift: s })} onDelete={() => setDeleting(s)} />
                          </div>
                      ),
                  },
              ]
            : []),
    ];

    // -----------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------
    return (
        <div className="space-y-4 px-1 pb-10">
            <header className="flex items-end justify-between gap-3 pt-2">
                <div className="space-y-0.5">
                    <p className="text-label text-emerald-500 text-left">{t('admin.administration')}</p>
                    <h1 className="text-display text-gray-900 dark:text-white">{t('nav.timesheets')}</h1>
                </div>
                <div className="flex items-center gap-2">
                    {selected ? (
                        <ExportMenu
                            open={exportOpen}
                            setOpen={setExportOpen}
                            onPick={doExport}
                            disabled={shifts.length === 0}
                            title={t('ts.exportThis')}
                            Icon={DownloadSimpleIcon}
                        />
                    ) : (
                        <ExportMenu
                            open={exportAllOpen}
                            setOpen={setExportAllOpen}
                            onPick={doExportAll}
                            disabled={exportingAll || members.length === 0}
                            title={t('ts.exportAll')}
                            Icon={UsersThreeIcon}
                            busy={exportingAll}
                        />
                    )}
                    <MonthPicker value={month} onChange={setMonth} />
                </div>
            </header>

            {/* MEMBER PICKER */}
            {!selected ? (
                <div className="space-y-3">
                    <div className="relative">
                        <MagnifyingGlassIcon weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder={t('ts.searchEmployees')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/40 py-2.5 pl-9 pr-3 text-body text-gray-900 dark:text-white outline-none focus:border-emerald-500/40 shadow-sm transition-all"
                        />
                    </div>

                    <DataTable
                        rows={filteredMembers}
                        rowKey={(m) => m.id}
                        isLoading={membersQ.isLoading}
                        loadingState={<div className="py-20 text-center text-label text-gray-400 animate-pulse">{t('state.loading', { label: t('admin.nounEmployees') })}</div>}
                        emptyState={<div className="py-20 text-center text-label text-gray-400">{t('state.empty', { label: t('admin.nounEmployees') })}</div>}
                        onRowClick={(m) => { setSelectedId(m.id); setSearch(''); }}
                        columns={[
                            {
                                key: 'employee',
                                header: t('admin.colEmployee'),
                                render: (m) => (
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border-2 border-white dark:border-white/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-micro shrink-0">
                                            {getFullInitials(m.first_name, m.last_name)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-body-strong text-gray-900 dark:text-white truncate">{memberName(m)}</p>
                                            <p className="text-micro text-emerald-600 dark:text-emerald-400 truncate normal-case">@{m.username}</p>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: 'role',
                                header: t('profile.field.role'),
                                align: 'right',
                                width: 'w-24 sm:w-32',
                                render: (m) => (
                                    <span className={`inline-block px-1.5 py-1 text-micro tracking-tight rounded-md whitespace-nowrap ${getRoleBadgeColor(m.role.name)}`}>
                                        {m.role.name}
                                    </span>
                                ),
                            },
                            {
                                key: 'caret',
                                header: '',
                                align: 'right',
                                width: 'w-8',
                                render: () => <CaretRightIcon weight="bold" className="w-4 h-4 text-gray-300 inline" />,
                            },
                        ]}
                    />
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Selected member header */}
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 shadow-sm">
                        <button
                            onClick={backToList}
                            className="shrink-0 p-2 -ml-1 rounded-xl text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-white/5 transition-colors"
                            aria-label={t('ts.backToEmployees')}
                        >
                            <CaretLeftIcon weight="bold" className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setProfileOpen(true)}
                            className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-xl -m-1 p-1 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                            aria-label={`View ${memberName(selected)}'s profile`}
                        >
                            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border-2 border-white dark:border-white/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-xs font-black shrink-0">
                                {getFullInitials(selected.first_name, selected.last_name)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-body-strong text-gray-900 dark:text-white truncate">{memberName(selected)}</p>
                                <p className="text-micro text-emerald-600 dark:text-emerald-400 truncate normal-case">@{selected.username}</p>
                            </div>
                        </button>
                        <span className={`shrink-0 px-1.5 py-1 text-micro tracking-tight rounded-md whitespace-nowrap ${getRoleBadgeColor(selected.role.name)}`}>
                            {selected.role.name}
                        </span>
                    </div>

                    {/* Summary stats */}
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: t('ts.netHours'), value: fmtHours(totals.net) },
                            { label: t('overview.shifts'), value: String(totals.count) },
                            { label: t('ts.breaks'), value: fmtHours(totals.brk) },
                        ].map((s) => (
                            <div key={s.label} className="bg-white dark:bg-gray-800/40 p-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                                <p className="text-micro text-gray-400 mb-1 truncate">{s.label}</p>
                                <p className="text-metric text-emerald-600 dark:text-emerald-400">{s.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Table header + add */}
                    <div className="flex items-center justify-between gap-2 px-1">
                        <p className="text-caption leading-relaxed text-gray-400">
                            Net = Gross − mandatory breaks:{' '}
                            <span className="whitespace-nowrap">−30&nbsp;min from 6&nbsp;h</span>,{' '}
                            <span className="whitespace-nowrap">−1&nbsp;h from 12&nbsp;h</span>.
                        </p>
                        {canEdit && (
                            <button
                                onClick={() => setEditing({ shift: null })}
                                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-label shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 active:scale-95 transition-all"
                            >
                                <PlusIcon weight="bold" className="w-4 h-4" /> Add
                            </button>
                        )}
                    </div>

                    {shiftsQ.isLoading ? (
                        <div className="py-20 text-center text-label text-gray-400 animate-pulse">{t('state.loading', { label: t('admin.nounShifts') })}</div>
                    ) : shifts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500">
                                <ClockUserIcon weight="bold" className="w-7 h-7" />
                            </div>
                            <div>
                                <h2 className="text-heading text-gray-900 dark:text-white">{month ? t('ts.noShiftsMonth') : t('ts.noShiftsYet')}</h2>
                                <p className="text-body text-gray-400 mt-1">
                                    {canEdit ? t('ts.emptyHintAdd') : t('ts.emptyHintMonth')}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <DataTable rows={shifts} rowKey={(s) => s.id} columns={columns} />
                    )}
                </div>
            )}

            {/* Editor modal */}
            <AnimatePresence>
                {editing && selected && (
                    <ShiftEditorModal
                        member={selected}
                        shift={editing.shift}
                        locations={locations}
                        onClose={() => setEditing(null)}
                        onSubmit={handleSubmit}
                    />
                )}
            </AnimatePresence>

            {/* Delete confirm */}
            <AnimatePresence>
                {deleting && (
                    <ConfirmDialog
                        title={t('ts.deleteShiftTitle')}
                        message={t('ts.deleteShiftMessage')}
                        confirmLabel={t('common.delete')}
                        onConfirm={handleDelete}
                        onClose={() => setDeleting(null)}
                    />
                )}
                {profileOpen && selected && (
                    <UserProfileModal userId={selected.id} onClose={() => setProfileOpen(false)} />
                )}
            </AnimatePresence>
        </div>
    );
}
