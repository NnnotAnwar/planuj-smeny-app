import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, FilePdfIcon, FileXlsIcon, DownloadSimpleIcon, CaretDownIcon, MapPinIcon, CalendarBlankIcon, TableIcon, EraserIcon, CopySimpleIcon, PaperPlaneTiltIcon, UsersThreeIcon } from '@phosphor-icons/react';

import { useAuthContext } from '@features/auth/AuthContext';
import { useShiftContext } from '@features/shifts/ShiftContext';
import { useTranslation, usePreferences } from '@shared/preferences/PreferencesContext';
import { Button } from '@shared/components/Button';
import { SearchInput } from '@shared/components/SearchInput';
import { MonthPicker } from '@shared/components/MonthPicker';
import { Skeleton } from '@shared/components/Skeleton';
import { ConfirmDialog } from '@features/admin/components/Modal';
import { timesheetService } from '@features/timesheets/timesheetService';
import { formatTime, formatDateLong } from '@shared/utils/date';
import type { ScheduledShift, TimeOff } from '@shared/types';
import { scheduleService } from './scheduleService';
import { UserProfileModal } from '@features/profile/components/UserProfileModal';
import { ScheduledShiftEditor, type DayEditorResult } from './components/ScheduledShiftEditor';
import { MonthCalendar } from './components/MonthCalendar';
import { RosterGrid, type RosterRow } from './components/RosterGrid';
import { MemberSearchAdd } from './components/MemberSearchAdd';
import { quickFillDays, copyTargetDay } from './scheduleLogic';
import { MyTeam } from './components/MyTeam';
import { TimeOffCard } from './components/TimeOffCard';
import { toast } from '@shared/toast/toastStore';
import { exportSchedule, type ScheduleExportSection } from './exportSchedule';
import { PageHeader } from '@shared/components/PageHeader';
import { useDismissibleWarning } from '@shared/hooks/useDismissibleWarning';
import { useHolidays } from './holidays/useHolidays';
import { HolidayWarningDialog, HOLIDAY_WARNING_KEY } from './holidays/HolidayWarning';
import { useAvailability } from '@features/availability/useAvailability';
import { availabilityOn } from '@features/availability/availabilityLogic';
import { AvailabilityCard } from '@features/availability/AvailabilityCard';
import { useCoverage } from './coverage/useCoverage';
import { CoverageDialog } from './coverage/CoverageDialog';
import { useShiftConfirmations } from './confirmation/useShiftConfirmations';
import { UpcomingShifts } from './confirmation/UpcomingShifts';
import { useShiftTemplates } from './templates/useShiftTemplates';
import { OpenShiftsCard } from './openShifts/OpenShiftsCard';
import { ShiftTimeMenu, type ShiftTimeValue } from './templates/ShiftTimeMenu';
import { tplTime } from './templates/templateTime';
import { TemplateBrush } from './templates/TemplateBrush';
import { TemplatesDialog } from './templates/TemplatesDialog';
import { buildShiftDates } from '@features/timesheets/shiftTimes';

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
    // Member profile modal (opened by tapping a name in the roster grid).
    const [profileUserId, setProfileUserId] = useState<string | null>(null);
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

    // --- v1.10 planning aids: holidays, availability, coverage, confirmations, templates ---
    const { language } = usePreferences();
    const { holidayName } = useHolidays(monthFrom, monthTo);
    const holidayFor = (date: string) => holidayName(date, language === 'cs' ? 'cs' : 'en');
    const holidayWarn = useDismissibleWarning(HOLIDAY_WARNING_KEY);
    const [holidayAsk, setHolidayAsk] = useState<{ date: string; name: string; run: () => void } | null>(null);
    const availability = useAvailability(user);
    const availabilityFor = (memberId: string, date: string) => availabilityOn(availability.org.data ?? [], memberId, date);
    const coverage = useCoverage(user);
    const dowOf = (date: string) => {
        const [y, m, d] = date.split('-').map(Number);
        return new Date(y, m - 1, d).getDay();
    };
    const requiredOn = (locId: string | null) => (date: string) => (locId ? coverage.requiredFor(locId, dowOf(date)) : 0);
    const [coverageFor, setCoverageFor] = useState<{ id: string; name: string } | null>(null);
    const [now] = useState(() => Date.now());
    const confirmations = useShiftConfirmations(user);
    const orgConfirmed = useMemo(
        () => new Set((confirmations.orgConfirmations.data ?? []).map((c) => c.scheduled_shift_id)),
        [confirmations.orgConfirmations.data],
    );
    const templates = useShiftTemplates(canManage ? user : null);
    const templateList = useMemo(() => templates.list.data ?? [], [templates.list.data]);
    // Roster grid "brush": what a tap on an empty cell puts down (null = all day).
    const [brushId, setBrushId] = useState<string | null>(null);
    const brush = templateList.find((tpl) => tpl.id === brushId) ?? null;
    const [cellMenu, setCellMenu] = useState<{ shift: ScheduledShift; anchor: DOMRect } | null>(null);
    const [managingTemplates, setManagingTemplates] = useState(false);
    const saveTemplateFromTimes = (start: string, end: string) =>
        templates.create.mutate({ name: `${start}–${end}`, start_time: start, end_time: end });

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
    const cellTap = (locId: string | null) => (memberId: string, date: string, anchor: DOMRect) => {
        const leave = leaveOn(memberId, date);
        if (leave) {
            toast(t('schedule.busyAt', { where: t(`timeoff.${leave.kind}` as 'timeoff.vacation') }), 'info');
            return;
        }
        const sameDay = shifts.filter((s) => s.user_id === memberId && sameLocalDay(s.starts_at, date));
        const here = sameDay.filter((s) => s.location_id === locId);
        // Tapping an existing shift opens its menu (times / template / all day / remove).
        if (here.length > 0) {
            setCellMenu({ shift: here[0], anchor });
            return;
        }
        if (sameDay.length > 0) {
            const s = sameDay[0];
            const when = s.all_day ? t('schedule.allDay') : `${formatTime(s.starts_at)}–${formatTime(s.ends_at)}`;
            toast(t('schedule.busyAt', { where: `${locationName(s.location_id)} · ${when}` }), 'info');
            return;
        }
        // An empty cell gets whatever the brush holds: all day, or a template's times.
        const row = brush
            ? (() => {
                  const { startDate, endDate } = buildShiftDates(date, tplTime(brush.start_time), tplTime(brush.end_time));
                  return { user_id: memberId, starts_at: startDate.toISOString(), ends_at: endDate.toISOString(), all_day: false };
              })()
            : (() => {
                  const [y, m, d] = date.split('-').map(Number);
                  return {
                      user_id: memberId,
                      starts_at: new Date(y, m - 1, d).toISOString(),
                      ends_at: new Date(y, m - 1, d + 1).toISOString(),
                      all_day: true,
                  };
              })();
        const run = () =>
            quickM.mutate(() => scheduleService.createMany(user.organization_id, user.id, [row], { location_id: locId, note: null }));
        // Planning onto a public holiday asks once first (silenceable per device).
        const holiday = holidayFor(date);
        if (holiday && !holidayWarn.dismissed) setHolidayAsk({ date, name: holiday, run });
        else run();
    };

    /** Apply a cell-menu choice to that shift (same day, new times / all day). */
    const applyCellTime = (shift: ScheduledShift, v: ShiftTimeValue) => {
        const day = new Date(shift.starts_at);
        const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
        const bounds = v.allDay
            ? { starts_at: new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString(), ends_at: new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).toISOString() }
            : (() => {
                  const { startDate, endDate } = buildShiftDates(date, v.start, v.end);
                  return { starts_at: startDate.toISOString(), ends_at: endDate.toISOString() };
              })();
        quickM.mutate(
            () =>
                scheduleService.update(shift.id, {
                    user_id: shift.user_id,
                    location_id: shift.location_id,
                    note: shift.note ?? null,
                    all_day: v.allDay,
                    ...bounds,
                }),
            { onSuccess: () => setCellMenu(null) },
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
        const rows: Array<{ user_id: string; starts_at: string; ends_at: string; all_day: boolean }> = [];
        for (const day of quickFillDays(selectedMonth, action)) {
            const dateKey = `${selectedMonth}-${pad(day)}`;
            if (blocked.has(dateKey) || leaveOn(memberId, dateKey)) continue;
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
                    const targetDay = copyTargetDay(d, prevOffset, targetOffset);
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
    const cardClass = 'glass rounded-2xl overflow-hidden';

    return (
        <div className="space-y-4 px-1 pb-10">
            {/* HEADER — controls mirror the Overview page (export dropdown + month picker). */}
            <PageHeader
                eyebrow={canManage ? t('schedule.roster') : t('schedule.mine')}
                title={t('nav.schedule')}
                actions={
                    <>
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="relative">
                                <button
                                    onClick={() => setExportOpen((v) => !v)}
                                    disabled={!hasAnything}
                                    className="glass flex items-center justify-center w-9 h-9 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 active:scale-90 transition-all disabled:opacity-40"
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
                                                className="glass glass-menu absolute right-0 top-full z-50 w-44 rounded-2xl p-1.5 overflow-hidden"
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
                    </>
                }
            />

            {/* Tabs (managers) + quick add */}
            {canManage && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <div className="segmented">
                            {(['team', 'mine'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveTab(tab)}
                                    className={`rounded-[9px] px-2.5 py-1 text-meta font-semibold transition-colors ${
                                        activeTab === tab
                                            ? 'segment-active text-ink dark:text-white'
                                            : 'text-ink-soft dark:text-slate-400 hover:text-ink dark:hover:text-white'
                                    }`}
                                >
                                    {tab === 'team' ? t('schedule.tabTeam') : t('schedule.tabMine')}
                                </button>
                            ))}
                        </div>
                        {teamView && (
                            <div className="segmented">
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
                                        className={`rounded-[9px] px-2 py-1 transition-colors ${
                                            viewMode === mode
                                                ? 'segment-active text-emerald-600 dark:text-emerald-300'
                                                : 'text-ink-soft dark:text-slate-400 hover:text-ink dark:hover:text-white'
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
                                className={`rounded-xl px-2.5 py-1.5 text-meta font-semibold border transition-colors ${
                                    teamOnly
                                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-white/60 dark:bg-white/5 border-ink/10 dark:border-white/10 text-ink-soft dark:text-slate-400 hover:text-ink dark:hover:text-white'
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

            {/* OPEN SHIFTS — post (managers) / claim (members). */}
            {user && <OpenShiftsCard user={user} locations={locations} canManage={teamView} />}

            {scheduleQ.isLoading ? (
                <div className="space-y-3" aria-hidden>
                    {[0, 1].map((i) => (
                        <Skeleton key={i} className="h-56 rounded-3xl" />
                    ))}
                </div>
            ) : teamView ? (
                <div className="space-y-3">
                    {viewMode === 'grid' && (
                        <TemplateBrush
                            templates={templateList}
                            value={brush?.id ?? null}
                            onChange={setBrushId}
                            onManage={() => setManagingTemplates(true)}
                        />
                    )}
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
                                            <span className="flex items-center gap-1.5 text-caption text-gray-400">
                                                {sec.items.length} {t('schedule.shiftsCount')}
                                                {(() => {
                                                    const due = sec.items.filter((s) => s.published && new Date(s.starts_at).getTime() > now);
                                                    if (due.length === 0) return null;
                                                    const done = due.filter((s) => orgConfirmed.has(s.id)).length;
                                                    return (
                                                        <span
                                                            className={`rounded-full px-1.5 text-[10px] font-semibold leading-4 ${
                                                                done === due.length ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/12 text-amber-700 dark:text-amber-300'
                                                            }`}
                                                        >
                                                            {t('confirm.progress', { done, total: due.length })}
                                                        </span>
                                                    );
                                                })()}
                                            </span>
                                        </span>
                                        <CaretDownIcon
                                            weight="bold"
                                            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                    {sec.id && (
                                        <button
                                            type="button"
                                            onClick={() => setCoverageFor({ id: sec.id!, name: sec.name })}
                                            title={t('coverage.title')}
                                            aria-label={`${t('coverage.title')}: ${sec.name}`}
                                            className="shrink-0 p-2 rounded-xl text-gray-400 hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                                        >
                                            <UsersThreeIcon weight="bold" className="w-4 h-4" />
                                        </button>
                                    )}
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
                                                            onCellTap={(memberId, date, anchor) => cellTap(sec.id)(memberId, date, anchor)}
                                                            onQuickFill={quickFill(sec.id)}
                                                            onRemoveRow={removeMember(sec.id, sec.items)}
                                                            onOpenProfile={setProfileUserId}
                                                            holidayFor={holidayFor}
                                                            requiredOn={requiredOn(sec.id)}
                                                            availabilityFor={availabilityFor}
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
                                            holidayFor={holidayFor}
                                            requiredOn={requiredOn(sec.id)}
                                            isConfirmed={(s) => orgConfirmed.has(s.id)}
                                        />
                                    ))}
                            </section>
                        );
                    })}
                </div>
            ) : (
                <div className="space-y-3">
                    <UpcomingShifts user={user} shifts={myShifts} locationName={locationName} />
                    <section className={cardClass}>
                        <MonthCalendar
                            monthKey={selectedMonth}
                            shifts={myShifts}
                            chipLabel={(s) => locationName(s.location_id)}
                            canManage={false}
                            holidayFor={holidayFor}
                            isConfirmed={(s) => confirmations.confirmedIds.has(s.id)}
                        />
                        {myShifts.length === 0 && (
                            <p className="px-4 pb-4 text-center text-caption text-gray-400">{t('schedule.noShiftsMonth')}</p>
                        )}
                    </section>
                    <AvailabilityCard user={user} />
                </div>
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
                        holidayName={holidayFor}
                        availabilityFor={availabilityFor}
                        templates={templateList}
                        onSaveTemplate={(input) => templates.create.mutateAsync(input)}
                        onRemoveTemplate={(id) => templates.remove.mutate(id)}
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
                {profileUserId && <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />}
                {holidayAsk && (
                    <HolidayWarningDialog
                        date={holidayAsk.date}
                        name={holidayAsk.name}
                        onClose={() => setHolidayAsk(null)}
                        onConfirm={(dontShowAgain) => {
                            if (dontShowAgain) holidayWarn.dismissForever();
                            holidayAsk.run();
                            setHolidayAsk(null);
                        }}
                    />
                )}
                {managingTemplates && user && <TemplatesDialog user={user} onClose={() => setManagingTemplates(false)} />}
                {coverageFor && user && (
                    <CoverageDialog user={user} locationId={coverageFor.id} locationName={coverageFor.name} onClose={() => setCoverageFor(null)} />
                )}
            </AnimatePresence>

            {/* Roster-grid cell menu for an existing shift. */}
            {cellMenu && (() => {
                const s0 = cellMenu.shift;
                const hhmm = (iso: string) => {
                    const d = new Date(iso);
                    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
                };
                const fallback = brush ? { start: tplTime(brush.start_time), end: tplTime(brush.end_time) } : { start: '08:00', end: '16:00' };
                return (
                    <ShiftTimeMenu
                        anchor={cellMenu.anchor}
                        title={`${memberFull(s0)} · ${formatDateLong(s0.starts_at)}`}
                        value={s0.all_day ? { allDay: true, ...fallback } : { allDay: false, start: hhmm(s0.starts_at), end: hhmm(s0.ends_at) }}
                        templates={templateList}
                        busy={quickM.isPending}
                        onPick={(v) => applyCellTime(s0, v)}
                        onSaveTemplate={saveTemplateFromTimes}
                        onRemove={() => quickM.mutate(() => scheduleService.removeMany([s0.id]), { onSuccess: () => setCellMenu(null) })}
                        onClose={() => setCellMenu(null)}
                    />
                );
            })()}
        </div>
    );
}
