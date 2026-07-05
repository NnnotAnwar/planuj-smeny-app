import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, FilePdfIcon, FileXlsIcon, DownloadSimpleIcon, CaretDownIcon, MapPinIcon, CalendarBlankIcon, TableIcon, EraserIcon, CopySimpleIcon, PaperPlaneTiltIcon } from '@phosphor-icons/react';

import { useAuthContext } from '@features/auth/AuthContext';
import { useShiftContext } from '@features/shifts/ShiftContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { Button } from '@shared/components/Button';
import { SearchInput } from '@shared/components/SearchInput';
import { MonthPicker } from '@shared/components/MonthPicker';
import { Skeleton } from '@shared/components/Skeleton';
import { ConfirmDialog } from '@features/admin/components/Modal';
import { timesheetService } from '@features/timesheets/timesheetService';
import { formatTime } from '@shared/utils/date';
import type { ScheduledShift, TimeOff } from '@shared/types';
import { scheduleService } from './scheduleService';
import { ScheduledShiftEditor, type DayEditorResult } from './components/ScheduledShiftEditor';
import { MonthCalendar } from './components/MonthCalendar';
import { RosterGrid, type RosterRow } from './components/RosterGrid';
import { MemberSearchAdd } from './components/MemberSearchAdd';
import { MyTeam } from './components/MyTeam';
import { TimeOffCard } from './components/TimeOffCard';
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
    // Free-text person filter (narrows grid rows and calendar chips).
    const [personQuery, setPersonQuery] = useState('');
    // Calendar (day-first) vs roster grid (people × days), persisted per device.
    const [viewMode, setViewMode] = useState<'calendar' | 'grid'>(
        () => (localStorage.getItem('schedule-view') === 'calendar' ? 'calendar' : 'grid'),
    );
    const switchView = (mode: 'calendar' | 'grid') => {
        setViewMode(mode);
        localStorage.setItem('schedule-view', mode);
    };
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [exportOpen, setExportOpen] = useState(false);
    const [editing, setEditing] = useState<{ date: string; locationId: string | null } | null>(null);
    // Destructive actions (remove member / clear location / clear month) confirm here.
    const [confirming, setConfirming] = useState<{ title: string; message: string; run: () => Promise<void> } | null>(null);

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

    // Leave (vacation / sick / other) overlapping this month.
    const monthFrom = `${selectedMonth}-01`;
    const monthTo = useMemo(() => {
        const [y, m] = selectedMonth.split('-').map(Number);
        return `${selectedMonth}-${pad(new Date(y, m, 0).getDate())}`;
    }, [selectedMonth]);
    const timeOffQ = useQuery({
        queryKey: ['time-off', selectedMonth],
        queryFn: () => scheduleService.getTimeOff(monthFrom, monthTo),
        enabled: !!user,
    });
    const timeOff = useMemo(() => timeOffQ.data ?? [], [timeOffQ.data]);

    /** Approved leave covering a local day, if any. */
    const leaveOn = (userId: string, date: string): TimeOff | undefined =>
        timeOff.find((e) => e.status === 'approved' && e.user_id === userId && e.starts_on <= date && date <= e.ends_on);

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

    const publishM = useMutation({
        mutationFn: () => scheduleService.publishMonth(monthStart.toISOString(), monthEnd.toISOString()),
        onSuccess: () => {
            invalidate();
            toast(t('schedule.publishedToast'), 'success');
        },
        onError: (err) => toast(err instanceof Error ? err.message : t('common.actionFailed'), 'error'),
    });

    // Quick roster-grid toggles (tap a cell): run the service call + refresh.
    const quickM = useMutation({
        mutationFn: (fn: () => Promise<void>) => fn(),
        onSuccess: invalidate,
        onError: (err) => toast(err instanceof Error && err.message !== 'SCHEDULE_OVERLAP' ? err.message : t('schedule.overlap'), 'error'),
    });

    const shifts = useMemo(() => scheduleQ.data ?? [], [scheduleQ.data]);
    const teamView = canManage && activeTab === 'team';
    const draftCount = useMemo(() => shifts.filter((s) => !s.published).length, [shifts]);

    // "My team only" + free-text person filter narrow what the calendars show.
    const visibleShifts = useMemo(() => {
        let list = shifts;
        if (teamOnly) {
            const mine = new Set((membersQ.data ?? []).filter((m) => m.manager_id === user?.id).map((m) => m.id));
            if (user) mine.add(user.id);
            list = list.filter((s) => mine.has(s.user_id));
        }
        const q = personQuery.trim().toLowerCase();
        if (q) {
            list = list.filter((s) => {
                const full = `${s.profiles?.first_name ?? ''} ${s.profiles?.last_name ?? ''} ${s.profiles?.username ?? ''}`.toLowerCase();
                return full.includes(q);
            });
        }
        return list;
    }, [shifts, teamOnly, personQuery, membersQ.data, user]);

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
            code: l.code ?? null,
            items: visibleShifts.filter((s) => s.location_id === l.id),
        }));
        const unassigned = visibleShifts.filter((s) => !s.location_id);
        if (unassigned.length > 0) list.push({ id: null, name: t('schedule.noLocation'), code: null, items: unassigned });
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
    /** What a day+location already holds. The editor calls this LIVE whenever
     *  its date or location changes, so ticks/busy always match the edited day. */
    const dayContext = (date: string, locId: string | null) => {
        const existing = shifts.filter((s) => s.location_id === locId && sameLocalDay(s.starts_at, date));
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
        // Approved leave locks the member for the day too.
        for (const e of timeOff) {
            if (e.status !== 'approved' || busy.has(e.user_id)) continue;
            if (e.starts_on <= date && date <= e.ends_on) {
                busy.set(e.user_id, t(`timeoff.${e.kind}` as 'timeoff.vacation'));
            }
        }
        return { existing, busy };
    };

    const openDay = (date: string, locId: string | null) => setEditing({ date, locationId: locId });

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
            removable: plannableIds.has(id),
        }));
        for (const s of items) {
            if (!rows.some((r) => r.id === s.user_id)) {
                // Present via shifts only — removing them deletes those shifts too.
                rows.push({ id: s.user_id, name: memberFull(s), editable: plannableIds.has(s.user_id), removable: plannableIds.has(s.user_id) });
            }
        }
        const q = personQuery.trim().toLowerCase();
        const filtered = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
        return filtered.sort((a, b) => a.name.localeCompare(b.name));
    };

    /** Tap a roster cell: toggle an all-day assignment for that member+day at
     *  this location; if they're busy elsewhere that day, explain via a toast. */
    const cellTap = (locId: string | null) => (memberId: string, date: string) => {
        const leave = leaveOn(memberId, date);
        if (leave) {
            toast(t('schedule.busyAt', { where: t(`timeoff.${leave.kind}` as 'timeoff.vacation') }), 'info');
            return;
        }
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

    /** Restaurant-style month fill: weeks alternate SHORT (Wed+Thu) and LONG
     *  (Mon, Tue, Fri–Sun). Picking a pattern REPLACES the member's previous
     *  all-day fills at this location (so short → long swaps cleanly instead
     *  of stacking into a 30-day streak); 'clear' wipes their month here.
     *  Timed shifts and days busy elsewhere are left alone / skipped. */
    const quickFill = (locId: string | null) => (memberId: string, action: 'short' | 'long' | 'clear') => {
        const mineHere = shifts.filter((s) => s.user_id === memberId && s.location_id === locId);

        if (action === 'clear') {
            if (mineHere.length === 0) {
                toast(t('schedule.nothingToFill'), 'info');
                return;
            }
            quickM.mutate(() => scheduleService.removeMany(mineHere.map((s) => s.id)));
            return;
        }

        // Replace previous all-day fills; keep hand-set timed shifts.
        const removeIds = mineHere.filter((s) => s.all_day).map((s) => s.id);
        // Days that stay blocked: their timed shifts here + anything elsewhere.
        const blocked = new Set(
            shifts
                .filter((s) => s.user_id === memberId && (s.location_id !== locId || !s.all_day))
                .map((s) => {
                    const d = new Date(s.starts_at);
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                }),
        );

        const [y, m] = selectedMonth.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Mon-first offset of day 1
        const rows: Array<{ user_id: string; starts_at: string; ends_at: string; all_day: boolean }> = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const dow = (new Date(y, m - 1, day).getDay() + 6) % 7; // 0 = Monday
            const weekIndex = Math.floor((day - 1 + offset) / 7);
            const isShortWeek = action === 'short' ? weekIndex % 2 === 0 : weekIndex % 2 === 1;
            const included = isShortWeek ? dow === 2 || dow === 3 : dow !== 2 && dow !== 3;
            const dateKey = `${selectedMonth}-${pad(day)}`;
            if (!included || blocked.has(dateKey) || leaveOn(memberId, dateKey)) continue;
            rows.push({
                user_id: memberId,
                starts_at: new Date(y, m - 1, day).toISOString(),
                ends_at: new Date(y, m - 1, day + 1).toISOString(),
                all_day: true,
            });
        }
        if (rows.length === 0 && removeIds.length === 0) {
            toast(t('schedule.nothingToFill'), 'info');
            return;
        }
        quickM.mutate(async () => {
            await scheduleService.removeMany(removeIds);
            await scheduleService.createMany(user.organization_id, user.id, rows, { location_id: locId, note: null });
        });
    };

    /** × on a roster row: confirm, then remove the member from this location —
     *  their roster entry AND their planned shifts here this month. */
    const removeMember = (locId: string | null, items: ScheduledShift[]) => (memberId: string) => {
        const name = (membersQ.data ?? []).find((m) => m.id === memberId);
        const display = name ? [name.first_name, name.last_name].filter(Boolean).join(' ') || name.username : '—';
        const ids = items.filter((s) => s.user_id === memberId).map((s) => s.id);
        setConfirming({
            title: t('schedule.removeTitle'),
            message: t('schedule.removeFromLocation', { name: display, month: periodLabel }),
            run: async () => {
                if (locId) await scheduleService.removeFromRoster(locId, memberId);
                await scheduleService.removeMany(ids);
                invalidate();
                qc.invalidateQueries({ queryKey: ['location-roster'] });
            },
        });
    };

    /** Eraser on a section header: clear every (plannable) shift there this month. */
    const clearLocation = (name: string, items: ScheduledShift[]) => {
        const plannableIds = new Set(plannableMembers.map((m) => m.id));
        const ids = items.filter((s) => plannableIds.has(s.user_id)).map((s) => s.id);
        setConfirming({
            title: t('schedule.clearLocation'),
            message: t('schedule.confirmClearLocation', { name, month: periodLabel }),
            run: async () => {
                await scheduleService.removeMany(ids);
                invalidate();
            },
        });
    };

    /** Copy last month's rota into this one, matching by (week index, weekday)
     *  so Mon-shifts land on Mondays. Days already holding anything for that
     *  member are skipped; timed shifts keep their time of day and duration. */
    const copyLastMonth = () => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const prevStart = new Date(y, m - 2, 1);
        const prevEnd = new Date(y, m - 1, 1);
        const prevLabel = prevStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        setConfirming({
            title: t('schedule.copyLast'),
            message: t('schedule.confirmCopyLast', { from: prevLabel, to: periodLabel }),
            run: async () => {
                const prev = await scheduleService.getRange(prevStart.toISOString(), prevEnd.toISOString());
                const plannableIds = new Set(plannableMembers.map((mm) => mm.id));
                const daysInTarget = new Date(y, m, 0).getDate();
                const prevOffset = (prevStart.getDay() + 6) % 7;
                const targetOffset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
                const taken = new Set(
                    shifts.map((s) => {
                        const d = new Date(s.starts_at);
                        return `${s.user_id}|${d.getDate()}`;
                    }),
                );
                const byLocation = new Map<string | null, Array<{ user_id: string; starts_at: string; ends_at: string; all_day: boolean }>>();
                for (const s of prev) {
                    if (!plannableIds.has(s.user_id)) continue;
                    const d = new Date(s.starts_at);
                    const dow = (d.getDay() + 6) % 7;
                    const weekIdx = Math.floor((d.getDate() - 1 + prevOffset) / 7);
                    const targetDay = weekIdx * 7 + dow - targetOffset + 1;
                    if (targetDay < 1 || targetDay > daysInTarget) continue;
                    const key = `${s.user_id}|${targetDay}`;
                    if (taken.has(key)) continue;
                    taken.add(key);
                    let starts: Date;
                    let ends: Date;
                    if (s.all_day) {
                        starts = new Date(y, m - 1, targetDay);
                        ends = new Date(y, m - 1, targetDay + 1);
                    } else {
                        const src = new Date(s.starts_at);
                        starts = new Date(y, m - 1, targetDay, src.getHours(), src.getMinutes());
                        ends = new Date(starts.getTime() + (new Date(s.ends_at).getTime() - src.getTime()));
                    }
                    const loc = s.location_id ?? null;
                    byLocation.set(loc, [
                        ...(byLocation.get(loc) ?? []),
                        { user_id: s.user_id, starts_at: starts.toISOString(), ends_at: ends.toISOString(), all_day: s.all_day },
                    ]);
                }
                for (const [loc, rows] of byLocation) {
                    await scheduleService.createMany(user.organization_id, user.id, rows, { location_id: loc, note: null });
                }
                invalidate();
            },
        });
    };

    /** Clear the whole month across all locations (plannable members only). */
    const clearAll = () => {
        const plannableIds = new Set(plannableMembers.map((m) => m.id));
        const ids = shifts.filter((s) => plannableIds.has(s.user_id)).map((s) => s.id);
        setConfirming({
            title: t('schedule.clearAll'),
            message: t('schedule.confirmClearAll', { month: periodLabel }),
            run: async () => {
                await scheduleService.removeMany(ids);
                invalidate();
            },
        });
    };

    const doExport = async (format: 'pdf' | 'excel') => {
        setExportOpen(false);
        const exportSections: ScheduleExportSection[] = teamView
            ? sections.map((sec) => ({ name: sec.name, shifts: sec.items, label: memberFull }))
            : [{ name: t('schedule.exportTitleMine'), shifts: myShifts, label: (s) => locationName(s.location_id) }];
        // Roster-grid view on screen → export the same people × days matrix.
        const gridSections = teamView && viewMode === 'grid'
            ? sections.map((sec) => ({
                  name: sec.name,
                  code: sec.code,
                  rows: rowsFor(sec.id, sec.items),
                  shifts: sec.items,
                  leaveFor: (memberId: string, date: string) => {
                      const e = leaveOn(memberId, date);
                      return e ? t(`timeoff.short_${e.kind}` as 'timeoff.short_vacation') : undefined;
                  },
              }))
            : undefined;
        await exportSchedule(format, {
            monthKey: selectedMonth,
            periodLabel,
            sections: exportSections,
            gridSections,
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
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
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
                            <div className="inline-flex rounded-2xl bg-gray-100 dark:bg-gray-800/40 p-1 shadow-sm">
                                {([
                                    { mode: 'grid' as const, Icon: TableIcon, label: t('schedule.viewGrid') },
                                    { mode: 'calendar' as const, Icon: CalendarBlankIcon, label: t('schedule.viewCalendar') },
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
                            <SearchInput
                                value={personQuery}
                                onChange={setPersonQuery}
                                placeholder={t('schedule.findPerson')}
                                className="flex-1 min-w-36 sm:flex-none sm:w-44 order-last sm:order-0"
                            />
                        )}
                    </div>
                    {teamView && (
                        <div className="flex flex-wrap items-center gap-2">
                            {draftCount > 0 && (
                                <Button size="sm" icon={PaperPlaneTiltIcon} loading={publishM.isPending} onClick={() => publishM.mutate()}>
                                    {t('schedule.publish', { count: draftCount })}
                                </Button>
                            )}
                            <Button size="sm" variant="secondary" icon={CopySimpleIcon} onClick={copyLastMonth}>
                                {t('schedule.copyLast')}
                            </Button>
                            {shifts.length > 0 && (
                                <Button size="sm" variant="secondary" icon={EraserIcon} onClick={clearAll} className="text-red-600 dark:text-red-400">
                                    {t('schedule.clearAll')}
                                </Button>
                            )}
                            <Button
                                size="sm"
                                icon={PlusIcon}
                                onClick={() => openDay(`${selectedMonth}-01`, sections[0]?.id ?? null)}
                            >
                                {t('schedule.add')}
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* MY TEAM — self-service: take free members / release your own. */}
            {teamView && user && (
                <MyTeam members={membersQ.data ?? []} userId={user.id} userRank={user.role.rank ?? 0} />
            )}

            {/* TIME OFF — approvals (managers) / own requests (members). */}
            {user && (
                <TimeOffCard
                    entries={timeOff}
                    members={plannableMembers}
                    selfId={user.id}
                    orgId={user.organization_id}
                    managerMode={teamView}
                />
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
                                <div className="flex items-center">
                                    <button
                                        type="button"
                                        onClick={() => toggleSection(key)}
                                        aria-expanded={isOpen}
                                        className="flex-1 min-w-0 flex items-center gap-2.5 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
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
                                    {sec.items.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => clearLocation(sec.name, sec.items)}
                                            title={t('schedule.clearLocation')}
                                            aria-label={`${t('schedule.clearLocation')}: ${sec.name}`}
                                            className="shrink-0 p-2 mr-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            <EraserIcon weight="bold" className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
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
                                                            code={sec.code}
                                                            leaveFor={(memberId, date) => {
                                                                const e = leaveOn(memberId, date);
                                                                return e ? t(`timeoff.short_${e.kind}` as 'timeoff.short_vacation') : undefined;
                                                            }}
                                                            canManage
                                                            onCellTap={(memberId, date) => cellTap(sec.id)(memberId, date)}
                                                            onQuickFill={quickFill(sec.id)}
                                                            onRemoveRow={removeMember(sec.id, sec.items)}
                                                        />
                                                    )}
                                                    {sec.id && addable.length > 0 && (
                                                        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-50 dark:border-gray-800/60">
                                                            <MemberSearchAdd
                                                                candidates={addable}
                                                                placeholder={t('schedule.addToLocation')}
                                                                onAdd={(userId) => rosterAddM.mutate({ locationId: sec.id!, userId })}
                                                            />
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
                                            onDayClick={(date) => openDay(date, sec.id)}
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
                        getDayContext={dayContext}
                        defaultDate={editing.date}
                        defaultLocationId={editing.locationId}
                        onClose={() => setEditing(null)}
                        onSubmit={(values) => applyDayM.mutateAsync(values)}
                    />
                )}
                {confirming && (
                    <ConfirmDialog
                        title={confirming.title}
                        message={confirming.message}
                        onClose={() => setConfirming(null)}
                        onConfirm={confirming.run}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
