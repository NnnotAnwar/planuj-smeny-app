import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, FilePdfIcon, FileXlsIcon, DownloadSimpleIcon, CaretDownIcon, MapPinIcon, CalendarBlankIcon, TableIcon } from '@phosphor-icons/react';

import { useAuthContext } from '@features/auth/AuthContext';
import { useShiftContext } from '@features/shifts/ShiftContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { Button } from '@shared/components/Button';
import { Select } from '@shared/components/Select';
import { MonthPicker } from '@shared/components/MonthPicker';
import { Skeleton } from '@shared/components/Skeleton';
import { timesheetService } from '@features/timesheets/timesheetService';
import { formatTime } from '@shared/utils/date';
import type { ScheduledShift } from '@shared/types';
import { scheduleService } from './scheduleService';
import { ScheduledShiftEditor, type DayEditorResult } from './components/ScheduledShiftEditor';
import { MonthCalendar } from './components/MonthCalendar';
import { RosterGrid, type RosterRow } from './components/RosterGrid';
import { MyTeam } from './components/MyTeam';
import { toast } from '@shared/toast/toastStore';
import { exportSchedule, type ScheduleExportSection } from './exportSchedule';

/**
 * --- SCHEDULE PAGE (rota) ---
 * A real month calendar per location: managers walk the location list and tap
 * a day to manage it (tick/untick members in the day editor); members get a
 * read-only calendar of their own shifts. Exports mirror the structure: a
 * printable PDF calendar page per location, or an Excel sheet per location.
 * Header controls (month picker + export dropdown) match the Overview page.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const sameLocalDay = (iso: string, date: string) =>
    new Date(iso).toDateString() === new Date(`${date}T00:00`).toDateString();

export default function SchedulePage() {
    const { user } = useAuthContext();
    const { locations } = useShiftContext();
    const t = useTranslation();
    const qc = useQueryClient();

    const canManage = (user?.role.rank ?? 0) >= 20;

    const [selectedMonth, setSelectedMonth] = useState(() => monthKeyOf(new Date()));
    const [activeTab, setActiveTab] = useState<'mine' | 'team'>(canManage ? 'team' : 'mine');
    // Filter the location calendars down to just the caller's team.
    const [teamOnly, setTeamOnly] = useState(false);
    // Calendar (day-first) vs roster grid (people × days), persisted per device.
    const [viewMode, setViewMode] = useState<'calendar' | 'grid'>(
        () => (localStorage.getItem('schedule-view') === 'grid' ? 'grid' : 'calendar'),
    );
    const switchView = (mode: 'calendar' | 'grid') => {
        setViewMode(mode);
        localStorage.setItem('schedule-view', mode);
    };
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [exportOpen, setExportOpen] = useState(false);
    const [editing, setEditing] = useState<{
        date: string;
        locationId: string | null;
        existing: ScheduledShift[];
        busy: Map<string, string>;
    } | null>(null);

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

    // Who belongs to each location's rota (curated by managers).
    const rosterQ = useQuery({
        queryKey: ['location-roster'],
        queryFn: () => scheduleService.getRoster(),
        enabled: canManage,
    });
    const rosterAddM = useMutation({
        mutationFn: ({ locationId, userId }: { locationId: string; userId: string }) =>
            scheduleService.addToRoster(user!.organization_id, user!.id, locationId, userId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['location-roster'] }),
        onError: (err) => toast(err instanceof Error ? err.message : t('common.actionFailed'), 'error'),
    });
    const rosterRemoveM = useMutation({
        mutationFn: ({ locationId, userId }: { locationId: string; userId: string }) =>
            scheduleService.removeFromRoster(locationId, userId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['location-roster'] }),
        onError: (err) => toast(err instanceof Error ? err.message : t('common.actionFailed'), 'error'),
    });

    // Managers (rank 20) plan only for members assigned to them (+ themselves);
    // admins (rank >= 30) plan for everyone.
    const plannableMembers = useMemo(() => {
        const all = membersQ.data ?? [];
        if ((user?.role.rank ?? 0) >= 30) return all;
        return all.filter((m) => m.manager_id === user?.id || m.id === user?.id);
    }, [membersQ.data, user]);

    const invalidate = () => qc.invalidateQueries({ queryKey: ['schedule'] });
    const applyDayM = useMutation({
        // The day editor's diff: unassign first (so re-ticking with new times
        // can't collide with the old row), then update, then create.
        mutationFn: async (values: DayEditorResult) => {
            await scheduleService.removeMany(values.removed_shift_ids);
            for (const u of values.updated) {
                await scheduleService.update(u.shift.id, {
                    user_id: u.shift.user_id,
                    location_id: u.shift.location_id,
                    starts_at: u.starts_at,
                    ends_at: u.ends_at,
                    all_day: u.all_day,
                    note: u.shift.note ?? null,
                });
            }
            await scheduleService.createMany(user!.organization_id, user!.id, values.added, {
                location_id: values.location_id,
                note: values.note,
            });
        },
        onSuccess: invalidate,
    });

    // Quick roster-grid toggles (tap a cell): run the service call + refresh.
    const quickM = useMutation({
        mutationFn: (fn: () => Promise<void>) => fn(),
        onSuccess: invalidate,
        onError: (err) => toast(err instanceof Error && err.message !== 'SCHEDULE_OVERLAP' ? err.message : t('schedule.overlap'), 'error'),
    });

    const shifts = useMemo(() => scheduleQ.data ?? [], [scheduleQ.data]);
    const teamView = canManage && activeTab === 'team';

    // "My team only": narrow the calendars to the caller's own people (+ self),
    // so a manager sees at a glance where their members were sent.
    const visibleShifts = useMemo(() => {
        if (!teamOnly) return shifts;
        const mine = new Set((membersQ.data ?? []).filter((m) => m.manager_id === user?.id).map((m) => m.id));
        if (user) mine.add(user.id);
        return shifts.filter((s) => mine.has(s.user_id));
    }, [shifts, teamOnly, membersQ.data, user]);

    // Team view: one calendar section per active location (keep archived ones
    // that still hold shifts this month), plus a "no location" bucket.
    const sections = useMemo(() => {
        if (!teamView) return [];
        const withShifts = new Set(visibleShifts.map((s) => s.location_id));
        const visible = locations
            .filter((l) => !l.archived_at || withShifts.has(l.id))
            .sort((a, b) => a.name.localeCompare(b.name));
        const list = visible.map((l) => ({
            id: l.id as string | null,
            name: l.name,
            items: visibleShifts.filter((s) => s.location_id === l.id),
        }));
        const unassigned = visibleShifts.filter((s) => !s.location_id);
        if (unassigned.length > 0) list.push({ id: null, name: t('schedule.noLocation'), items: unassigned });
        return list;
    }, [teamView, locations, visibleShifts, t]);

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

    /** Open the day editor for a location section: current assignments +
     *  "busy elsewhere" hints for everyone scheduled at other locations. */
    const openDay = (date: string, locId: string | null, items: ScheduledShift[]) => {
        const existing = items.filter((s) => sameLocalDay(s.starts_at, date));
        // Anyone with a same-day assignment that this dialog does NOT manage
        // (other locations, or rows hidden by the team filter) is locked as
        // busy — a tick can then never double-book.
        const managedIds = new Set(existing.map((e) => e.id));
        const busy = new Map<string, string>();
        for (const s of shifts) {
            if (managedIds.has(s.id) || !sameLocalDay(s.starts_at, date)) continue;
            const when = s.all_day ? t('schedule.allDay') : `${formatTime(s.starts_at)}–${formatTime(s.ends_at)}`;
            busy.set(s.user_id, `${locationName(s.location_id)} · ${when}`);
        }
        setEditing({ date, locationId: locId, existing, busy });
    };

    /** Roster-grid rows for a location: its curated roster plus anyone already
     *  scheduled there this month. Roster members are removable; people who
     *  only appear via shifts are not (their assignments keep them visible). */
    const rowsFor = (locId: string | null, items: ScheduledShift[]): RosterRow[] => {
        const plannableIds = new Set(plannableMembers.map((m) => m.id));
        const rosterIds = locId ? (rosterQ.data?.get(locId) ?? new Set<string>()) : new Set<string>();
        const all = membersQ.data ?? [];
        const nameOf = (id: string) => {
            const m = all.find((x) => x.id === id);
            return m ? [m.first_name, m.last_name].filter(Boolean).join(' ') || m.username : '—';
        };
        const rows: RosterRow[] = [...rosterIds].map((id) => ({
            id,
            name: nameOf(id),
            editable: plannableIds.has(id),
            removable: true,
        }));
        for (const s of items) {
            if (!rows.some((r) => r.id === s.user_id)) {
                rows.push({ id: s.user_id, name: memberFull(s), editable: plannableIds.has(s.user_id), removable: false });
            }
        }
        return rows.sort((a, b) => a.name.localeCompare(b.name));
    };

    /** Tap a roster cell: toggle an all-day assignment for that member+day at
     *  this location; if they're busy elsewhere that day, explain via a toast. */
    const cellTap = (locId: string | null) => (memberId: string, date: string) => {
        const sameDay = shifts.filter((s) => s.user_id === memberId && sameLocalDay(s.starts_at, date));
        const here = sameDay.filter((s) => s.location_id === locId);
        if (here.length > 0) {
            quickM.mutate(() => scheduleService.removeMany(here.map((s) => s.id)));
            return;
        }
        if (sameDay.length > 0) {
            const s = sameDay[0];
            const when = s.all_day ? t('schedule.allDay') : `${formatTime(s.starts_at)}–${formatTime(s.ends_at)}`;
            toast(t('schedule.busyAt', { where: `${locationName(s.location_id)} · ${when}` }), 'info');
            return;
        }
        const [y, m, d] = date.split('-').map(Number);
        const start = new Date(y, m - 1, d);
        const end = new Date(y, m - 1, d + 1);
        quickM.mutate(() =>
            scheduleService.createMany(
                user.organization_id,
                user.id,
                [{ user_id: memberId, starts_at: start.toISOString(), ends_at: end.toISOString(), all_day: true }],
                { location_id: locId, note: null },
            ),
        );
    };

    const doExport = async (format: 'pdf' | 'excel') => {
        setExportOpen(false);
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
            {/* HEADER — controls mirror the Overview page (export dropdown + month picker). */}
            <header className="pt-2 flex items-end justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                    <p className="text-label text-emerald-500 text-left">{canManage ? t('schedule.roster') : t('schedule.mine')}</p>
                    <h1 className="text-display text-gray-900 dark:text-white">{t('nav.schedule')}</h1>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <div className="relative">
                        <button
                            onClick={() => setExportOpen((v) => !v)}
                            disabled={!hasAnything}
                            className="flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-500/10 active:scale-90 transition-all disabled:opacity-40"
                            title={t('overview.export')}
                        >
                            <DownloadSimpleIcon weight="bold" className="w-4 h-4" />
                        </button>
                        <AnimatePresence>
                            {exportOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 4, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                        className="absolute right-0 top-full z-50 w-44 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl p-1.5 overflow-hidden"
                                    >
                                        {([
                                            { fmt: 'pdf' as const, label: 'PDF', Icon: FilePdfIcon },
                                            { fmt: 'excel' as const, label: 'Excel', Icon: FileXlsIcon },
                                        ]).map(({ fmt, label, Icon }) => (
                                            <button
                                                key={fmt}
                                                onClick={() => doExport(fmt)}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-small text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-white/5 transition-colors"
                                            >
                                                <Icon weight="bold" className="w-4 h-4 text-emerald-500" />
                                                {label}
                                            </button>
                                        ))}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                    <MonthPicker value={selectedMonth} onChange={(v) => setSelectedMonth(v ?? monthKeyOf(new Date()))} />
                </div>
            </header>

            {/* Tabs (managers) + quick add */}
            {canManage && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
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
                        {teamView && (
                            <button
                                type="button"
                                onClick={() => setTeamOnly((v) => !v)}
                                aria-pressed={teamOnly}
                                className={`rounded-2xl px-3 py-2 text-small-strong border transition-colors ${
                                    teamOnly
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                {t('schedule.teamOnly')}
                            </button>
                        )}
                        {teamView && (
                            <div className="inline-flex rounded-2xl bg-gray-100 dark:bg-gray-800/40 p-1 shadow-sm">
                                {([
                                    { mode: 'calendar' as const, Icon: CalendarBlankIcon, label: t('schedule.viewCalendar') },
                                    { mode: 'grid' as const, Icon: TableIcon, label: t('schedule.viewGrid') },
                                ]).map(({ mode, Icon, label }) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => switchView(mode)}
                                        aria-pressed={viewMode === mode}
                                        aria-label={label}
                                        title={label}
                                        className={`rounded-xl px-2.5 py-1.5 transition-colors ${
                                            viewMode === mode
                                                ? 'bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        <Icon weight="bold" className="w-4 h-4" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {teamView && (
                        <Button
                            size="sm"
                            icon={PlusIcon}
                            onClick={() => openDay(`${selectedMonth}-01`, sections[0]?.id ?? null, sections[0]?.items ?? [])}
                        >
                            {t('schedule.add')}
                        </Button>
                    )}
                </div>
            )}

            {/* MY TEAM — self-service: take free members / release your own. */}
            {teamView && user && (
                <MyTeam members={membersQ.data ?? []} userId={user.id} userRank={user.role.rank ?? 0} />
            )}

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
                                {isOpen &&
                                    (viewMode === 'grid' ? (
                                        (() => {
                                            const rows = rowsFor(sec.id, sec.items);
                                            const rowIds = new Set(rows.map((r) => r.id));
                                            const addable = plannableMembers.filter((m) => !rowIds.has(m.id));
                                            return (
                                                <>
                                                    {rows.length === 0 ? (
                                                        <p className="px-4 py-3 text-caption text-gray-400">{t('schedule.rosterEmpty')}</p>
                                                    ) : (
                                                        <RosterGrid
                                                            monthKey={selectedMonth}
                                                            rows={rows}
                                                            shifts={sec.items}
                                                            canManage
                                                            onCellTap={(memberId, date) => cellTap(sec.id)(memberId, date)}
                                                            onRemoveRow={
                                                                sec.id
                                                                    ? (memberId) => rosterRemoveM.mutate({ locationId: sec.id!, userId: memberId })
                                                                    : undefined
                                                            }
                                                        />
                                                    )}
                                                    {sec.id && addable.length > 0 && (
                                                        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-50 dark:border-gray-800/60">
                                                            <div className="flex-1 min-w-0 max-w-64">
                                                                <Select
                                                                    size="sm"
                                                                    value=""
                                                                    onChange={(e) => {
                                                                        if (e.target.value) rosterAddM.mutate({ locationId: sec.id!, userId: e.target.value });
                                                                    }}
                                                                >
                                                                    <option value="">{t('schedule.addToLocation')}</option>
                                                                    {addable.map((m) => (
                                                                        <option key={m.id} value={m.id}>
                                                                            {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.username}
                                                                        </option>
                                                                    ))}
                                                                </Select>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()
                                    ) : (
                                        <MonthCalendar
                                            monthKey={selectedMonth}
                                            shifts={sec.items}
                                            chipLabel={memberShort}
                                            canManage
                                            onDayClick={(date) => openDay(date, sec.id, sec.items)}
                                        />
                                    ))}
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
                        members={plannableMembers}
                        locations={locations}
                        existing={editing.existing}
                        busy={editing.busy}
                        defaultDate={editing.date}
                        defaultLocationId={editing.locationId}
                        onClose={() => setEditing(null)}
                        onSubmit={(values) => applyDayM.mutateAsync(values)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
