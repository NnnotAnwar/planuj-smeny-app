import { useState } from 'react';
import { CheckIcon, ClockIcon, WarningIcon, CalendarStarIcon, XIcon, HeartIcon, BookmarkSimpleIcon, StorefrontIcon } from '@phosphor-icons/react';
import { Modal } from '@features/admin/components/Modal';
import { TimePicker } from '@shared/components/TimePicker';
import { DatePicker } from '@shared/components/DatePicker';
import { Select } from '@shared/components/Select';
import { Textarea } from '@shared/components/Input';
import { Button } from '@shared/components/Button';
import { FormError } from '@shared/components/FormError';
import type { Location, Profile, ScheduledShift } from '@shared/types';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { buildShiftDates } from '@features/timesheets/shiftTimes';
import type { Availability } from '@features/availability/types';
import { availabilityWindow } from '@features/availability/availabilityLogic';
import type { ShiftTemplate, ShiftTemplateInput } from '@features/schedule/templates/types';
import { HolidayWarningBody, HOLIDAY_WARNING_KEY } from '@features/schedule/holidays/HolidayWarning';
import { MAX_TEMPLATES, templateFor, tplTime } from '@features/schedule/templates/templateTime';
import { useDismissibleWarning } from '@shared/hooks/useDismissibleWarning';
import { isOutsideHours, isHoursShift, fullDayShift, type OpeningHours } from '@features/locations/settings/openingHours';

/**
 * --- DAY EDITOR ---
 * The single way to manage a rota day: tap a day, tick who works there —
 * unticking an assigned member unassigns them. Each member has their own
 * schedule mode: all-day by default, or exact times; tapping the time badge
 * flips back to all-day in one tap. Members already busy elsewhere that day
 * are flagged inline, as is each member's availability for the day.
 *
 * Templates ("Morning 7–15") stamp their times onto everyone ticked (top
 * bar) or onto one person (chips in their row) — so a day where people start
 * at different times is a few taps. Each row's times save as a template with
 * one tap (named after the times; rename in Manage templates). Planning onto a public holiday asks
 * once first (inline confirm step, silenceable per device).
 */

export interface DayEditorRow {
    user_id: string;
    starts_at: string; // ISO
    ends_at: string; // ISO
    all_day: boolean;
}

export interface DayEditorResult {
    added: DayEditorRow[];
    removed_shift_ids: string[];
    /** Existing assignments whose mode/times changed. */
    updated: Array<{ shift: ScheduledShift } & Omit<DayEditorRow, 'user_id'>>;
    location_id: string | null;
    note: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoToTime = (iso: string) => {
    const d = new Date(iso);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const memberName = (m: Profile) => [m.first_name, m.last_name].filter(Boolean).join(' ') || m.username;

interface RowState {
    selected: boolean;
    withTime: boolean;
    start: string;
    end: string;
}

/** What a given day+location already holds: assignments here + who's busy elsewhere. */
export interface DayContext {
    existing: ScheduledShift[];
    busy: Map<string, string>;
}

/** Seed rows from the day's assignments. A shift that is exactly the
 *  location's opening hours counts as the full day (the letter), not as times. */
const seedRows = (existing: ScheduledShift[], hours: OpeningHours | null): Map<string, RowState> => {
    const map = new Map<string, RowState>();
    for (const e of existing) {
        const fullDay = e.all_day || isHoursShift(e.starts_at, e.ends_at, e.all_day, hours);
        map.set(e.user_id, {
            selected: true,
            withTime: !fullDay,
            start: fullDay ? '08:00' : isoToTime(e.starts_at),
            end: fullDay ? '16:00' : isoToTime(e.ends_at),
        });
    }
    return map;
};

export function ScheduledShiftEditor({
    members,
    locations,
    getDayContext,
    defaultDate,
    defaultLocationId,
    onClose,
    onSubmit,
    holidayName,
    availabilityFor,
    templates,
    hoursFor,
    onSaveTemplate,
    onRemoveTemplate,
}: {
    members: Profile[];
    locations: Location[];
    /** Resolves what a day+location already holds — re-queried whenever the
     *  user changes the date or the location inside the dialog, so the ticks
     *  always reflect the day being edited (not the day it was opened on). */
    getDayContext: (date: string, locationId: string | null) => DayContext;
    defaultDate: string; // YYYY-MM-DD
    /** Preselected location (the calendar section the day was tapped in). */
    defaultLocationId?: string | null;
    onClose: () => void;
    onSubmit: (values: DayEditorResult) => Promise<void>;
    /** Localized public-holiday name for a day, or null. */
    holidayName?: (date: string) => string | null;
    /** A member's availability entry for the day being edited. */
    availabilityFor?: (memberId: string, date: string) => Availability | undefined;
    templates?: ShiftTemplate[];
    /** A location's opening hours — offered as a time chip, and shifts outside them are flagged. */
    hoursFor?: (locationId: string | null) => OpeningHours | null;
    onSaveTemplate?: (input: ShiftTemplateInput) => Promise<unknown>;
    onRemoveTemplate?: (id: string) => void;
}) {
    const t = useTranslation();
    const holidayWarn = useDismissibleWarning(HOLIDAY_WARNING_KEY);
    // Holiday confirm step: shown once per save attempt on a holiday date.
    const [holidayAsk, setHolidayAsk] = useState(false);
    const [dontShowHoliday, setDontShowHoliday] = useState(false);
    const pickable = locations.filter((l) => !l.archived_at);

    const [locationId, setLocationId] = useState(defaultLocationId ?? pickable[0]?.id ?? '');
    const [date, setDate] = useState(defaultDate);
    const [note, setNote] = useState('');
    const [busyState, setBusyState] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { existing, busy } = getDayContext(date, locationId || null);
    const existingByUser = new Map(existing.map((e) => [e.user_id, e]));
    // The location's opening hours: what "full day" means here, and the window
    // shifts get checked against.
    const hours = hoursFor?.(locationId || null) ?? null;
    const hoursText = hours ? `${hours.open}–${hours.close}` : '';

    // Per-member row state, seeded from the day's assignments. Changing the
    // date or location re-seeds from that day's context (adjust-during-render
    // pattern), so stale ticks from the previously shown day can't linger.
    const [rows, setRows] = useState<Map<string, RowState>>(() => seedRows(existing, hours));
    const [prevKey, setPrevKey] = useState(`${date}|${locationId}`);
    const key = `${date}|${locationId}`;
    if (key !== prevKey) {
        setPrevKey(key);
        setRows(seedRows(existing, hours));
        setHolidayAsk(false);
    }
    const holiday = holidayName?.(date) ?? null;

    const rowOf = (id: string): RowState => rows.get(id) ?? { selected: false, withTime: false, start: '08:00', end: '16:00' };
    const patchRow = (id: string, patch: Partial<RowState>) =>
        setRows((prev) => {
            const next = new Map(prev);
            next.set(id, { ...rowOf(id), ...patch });
            return next;
        });

    const toISO = (r: RowState) => {
        if (!r.withTime) return fullDayShift(date, hours);
        const { startDate, endDate } = buildShiftDates(date, r.start, r.end);
        return { starts_at: startDate.toISOString(), ends_at: endDate.toISOString(), all_day: false };
    };

    const selectedIds = members.filter((m) => rowOf(m.id).selected).map((m) => m.id);

    /** Stamp times (a template's, or the opening hours) onto everyone ticked. */
    const applyTimes = (start: string, end: string) => {
        if (selectedIds.length === 0) return setError(t('tpl.tickFirst'));
        setError(null);
        setRows((prev) => {
            const next = new Map(prev);
            for (const id of selectedIds) {
                next.set(id, { ...rowOf(id), withTime: true, start, end });
            }
            return next;
        });
    };
    const applyTemplate = (tpl: ShiftTemplate) => applyTimes(tplTime(tpl.start_time), tplTime(tpl.end_time));

    /** One tap: save a row's exact times as a template, named after them. */
    const saveRowTemplate = (r: RowState) => {
        if (!onSaveTemplate || templateFor(templates ?? [], r.start, r.end) || (templates?.length ?? 0) >= MAX_TEMPLATES) return;
        void onSaveTemplate({ name: `${r.start}–${r.end}`, start_time: r.start, end_time: r.end });
    };

    const handleSubmit = async () => {
        setError(null);
        const added: DayEditorRow[] = [];
        const updated: DayEditorResult['updated'] = [];
        for (const [id, r] of rows) {
            const prev = existingByUser.get(id);
            if (r.selected && !prev) {
                added.push({ user_id: id, ...toISO(r) });
            } else if (r.selected && prev) {
                const next = toISO(r);
                const changed =
                    prev.all_day !== next.all_day ||
                    Date.parse(prev.starts_at) !== Date.parse(next.starts_at) ||
                    Date.parse(prev.ends_at) !== Date.parse(next.ends_at);
                if (changed) updated.push({ shift: prev, ...next });
            }
        }
        const removed = existing.filter((e) => !rowOf(e.user_id).selected).map((e) => e.id);

        if (added.length === 0 && removed.length === 0 && updated.length === 0) {
            if (existing.length === 0) return setError(t('schedule.chooseMember'));
            onClose();
            return;
        }

        // Adding people on a public holiday: confirm once (unless silenced).
        if (holiday && added.length > 0 && !holidayWarn.dismissed && !holidayAsk) {
            setHolidayAsk(true);
            return;
        }
        if (holidayAsk && dontShowHoliday) holidayWarn.dismissForever();

        setBusyState(true);
        try {
            await onSubmit({ added, removed_shift_ids: removed, updated, location_id: locationId || null, note: note.trim() || null });
            onClose();
        } catch (err) {
            const msg = err instanceof Error ? err.message : '';
            setError(msg === 'SCHEDULE_OVERLAP' ? t('schedule.overlap') : msg || t('common.actionFailed'));
            setBusyState(false);
        }
    };

    return (
        <Modal wide title={existing.length > 0 ? t('schedule.editTitle') : t('schedule.addTitle')} onClose={onClose}>
            <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-label text-gray-400">{t('admin.colLocation')}</label>
                        <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                            {pickable.length === 0 && <option value="">{t('shiftEditor.noLocations')}</option>}
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

                {holiday && (
                    <p className="-mt-1 inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2 py-1 text-meta font-semibold text-rose-700 dark:text-rose-300">
                        <CalendarStarIcon weight="fill" className="size-3.5" />
                        {t('holiday.label')} · {holiday}
                    </p>
                )}

                {/* TEMPLATES — one tap sets the times for everyone ticked. */}
                {templates && templates.length > 0 && (
                    <div className="space-y-1.5">
                        <label className="text-label text-gray-400">{t('tpl.title')}</label>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {(templates ?? []).map((tpl) => (
                                <span key={tpl.id} className="group inline-flex items-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/15 dark:bg-emerald-400/10">
                                    <button
                                        type="button"
                                        onClick={() => applyTemplate(tpl)}
                                        className="px-2 py-1 text-meta font-semibold text-emerald-800 dark:text-emerald-200"
                                    >
                                        {tpl.name}{' '}
                                        <span className="font-medium tabular-nums text-emerald-700/70 dark:text-emerald-300/70">
                                            {tpl.start_time.slice(0, 5)}–{tpl.end_time.slice(0, 5)}
                                        </span>
                                    </button>
                                    {onRemoveTemplate && (
                                        <button
                                            type="button"
                                            onClick={() => onRemoveTemplate(tpl.id)}
                                            title={t('tpl.remove')}
                                            aria-label={`${t('tpl.remove')}: ${tpl.name}`}
                                            className="mr-1 rounded p-0.5 text-emerald-700/60 hover:bg-emerald-500/15 hover:text-red-600 dark:text-emerald-300/60"
                                        >
                                            <XIcon weight="bold" className="size-3" />
                                        </button>
                                    )}
                                </span>
                            ))}
                        </div>
                        <p className="text-caption text-ink-soft dark:text-slate-400">{t('tpl.hint')}</p>
                    </div>
                )}

                {/* WHO — tick to assign (all-day by default), untick to unassign.
                    The badge flips each member between all-day and exact times. */}
                <div className="space-y-1.5">
                    <label className="text-label text-gray-400">{t('schedule.members')}</label>
                    <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
                        {members.length === 0 && <p className="px-3 py-2.5 text-caption text-gray-400">—</p>}
                        {members.map((m) => {
                            const r = rowOf(m.id);
                            // Busy elsewhere that day (and not assigned here): the row is
                            // locked — you simply can't double-book someone with a tick.
                            const busyText = !r.selected ? busy?.get(m.id) : undefined;
                            const locked = !!busyText;
                            return (
                                <div key={m.id} className={`px-3 py-2 ${locked ? 'opacity-60' : ''}`}>
                                    <div className="flex items-center gap-2.5">
                                        <button
                                            type="button"
                                            disabled={locked}
                                            onClick={() => patchRow(m.id, { selected: !r.selected })}
                                            aria-pressed={r.selected}
                                            className={`flex items-center gap-2.5 flex-1 min-w-0 text-left ${locked ? 'cursor-not-allowed' : ''}`}
                                        >
                                            <span
                                                className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                                    r.selected
                                                        ? 'bg-emerald-600 border-emerald-600 text-white'
                                                        : locked
                                                          ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800'
                                                          : 'border-gray-300 dark:border-gray-600'
                                                }`}
                                            >
                                                {r.selected && <CheckIcon weight="bold" className="w-3 h-3" />}
                                            </span>
                                            <span className="min-w-0">
                                                <span className={`block truncate text-body ${r.selected ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-gray-300'}`}>
                                                    {memberName(m)}
                                                </span>
                                                {!busyText && (() => {
                                                    const av = availabilityFor?.(m.id, date);
                                                    if (!av) return null;
                                                    const cant = av.kind === 'unavailable';
                                                    return (
                                                        <span className={`flex items-center gap-1 text-caption ${cant ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                            {cant ? <WarningIcon weight="fill" className="size-3 shrink-0" /> : <HeartIcon weight="fill" className="size-3 shrink-0" />}
                                                            <span className="truncate">
                                                                {[cant ? t('avail.memberCant') : t('avail.memberPrefers'), availabilityWindow(av), av.note].filter(Boolean).join(' · ')}
                                                            </span>
                                                        </span>
                                                    );
                                                })()}
                                                {busyText && (
                                                    <span className="flex items-center gap-1 text-micro normal-case tracking-normal text-amber-600 dark:text-amber-400">
                                                        <WarningIcon weight="fill" className="w-3 h-3 shrink-0" />
                                                        {t('schedule.busyAt', { where: busyText })}
                                                    </span>
                                                )}
                                            </span>
                                        </button>

                                        {r.selected && (
                                            <button
                                                type="button"
                                                onClick={() => patchRow(m.id, { withTime: !r.withTime })}
                                                title={r.withTime ? (hours ? `${t('locset.hours')} ${hoursText}` : t('schedule.allDay')) : t('schedule.setTime')}
                                                className={`shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-micro font-bold tabular-nums normal-case tracking-normal transition-colors ${
                                                    r.withTime
                                                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200/70'
                                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                <ClockIcon weight="bold" className="w-3 h-3" />
                                                {r.withTime ? `${r.start}–${r.end}` : hours ? hoursText : t('schedule.allDay')}
                                            </button>
                                        )}
                                    </div>

                                    {r.selected && r.withTime && (
                                        <div className="mt-2 grid grid-cols-2 gap-2 pl-7">
                                            <TimePicker value={r.start} onChange={(v) => patchRow(m.id, { start: v })} aria-label={t('shiftEditor.startTime')} />
                                            <TimePicker value={r.end} onChange={(v) => patchRow(m.id, { end: v })} aria-label={t('shiftEditor.endTime')} />
                                            {r.end <= r.start && (
                                                <p className="col-span-2 text-micro text-amber-500">{t('shiftEditor.overnight')}</p>
                                            )}
                                            {(() => {
                                                const iso = toISO(r);
                                                return isOutsideHours(iso.starts_at, iso.ends_at, hours) ? (
                                                    <p className="col-span-2 flex items-center gap-1 text-caption font-medium text-amber-700 dark:text-amber-300">
                                                        <StorefrontIcon weight="bold" className="size-3.5" />
                                                        {t('locset.outside', { hours: hoursText })}
                                                    </p>
                                                ) : null;
                                            })()}
                                            {/* This person's time from a template, or save theirs as one. */}
                                            {(templates?.length || onSaveTemplate) && (
                                                <div className="col-span-2 flex flex-wrap items-center gap-1">
                                                    {(templates ?? []).map((tpl) => {
                                                        const on = tplTime(tpl.start_time) === r.start && tplTime(tpl.end_time) === r.end;
                                                        return (
                                                            <button
                                                                key={tpl.id}
                                                                type="button"
                                                                onClick={() => patchRow(m.id, { start: tplTime(tpl.start_time), end: tplTime(tpl.end_time) })}
                                                                aria-pressed={on}
                                                                className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${
                                                                    on
                                                                        ? 'bg-emerald-600 text-white'
                                                                        : 'bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-200'
                                                                }`}
                                                            >
                                                                {tpl.name}
                                                            </button>
                                                        );
                                                    })}
                                                    {onSaveTemplate && (() => {
                                                        const saved = templateFor(templates ?? [], r.start, r.end);
                                                        const atLimit = (templates?.length ?? 0) >= MAX_TEMPLATES;
                                                        if (!saved && atLimit) {
                                                            return <span className="text-[11px] text-ink-soft dark:text-slate-400">{t('tpl.limit')}</span>;
                                                        }
                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={() => saveRowTemplate(r)}
                                                                disabled={!!saved}
                                                                title={saved ? saved.name : t('tpl.saveRow')}
                                                                aria-label={t('tpl.saveRow')}
                                                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-white/8"
                                                            >
                                                                <BookmarkSimpleIcon weight={saved ? 'fill' : 'bold'} className={`size-3 ${saved ? 'text-emerald-600 dark:text-emerald-300' : ''}`} />
                                                                {saved ? null : t('tpl.save')}
                                                            </button>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-label text-gray-400">{t('schedule.note')}</label>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t('schedule.notePlaceholder')} />
                </div>

                <FormError message={error} />

                {holidayAsk && holiday && (
                    <HolidayWarningBody date={date} name={holiday} dontShow={dontShowHoliday} onDontShowChange={setDontShowHoliday} />
                )}

                <div className="flex gap-2 pt-1">
                    <Button variant="secondary" fullWidth onClick={onClose} disabled={busyState}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" fullWidth loading={busyState} onClick={handleSubmit}>
                        {busyState ? t('common.saving') : holidayAsk ? t('holiday.assignAnyway') : t('shiftEditor.saveChanges')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
