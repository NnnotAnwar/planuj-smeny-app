import { useState } from 'react';
import { CheckIcon, ClockIcon, WarningIcon } from '@phosphor-icons/react';
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

/**
 * --- DAY EDITOR ---
 * The single way to manage a rota day: tap a day, tick who works there —
 * unticking an assigned member unassigns them. Each member has their own
 * schedule mode: all-day by default, or exact times; tapping the time badge
 * flips back to all-day in one tap. Members already busy elsewhere that day
 * are flagged inline.
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

/** Local [00:00, next-day 00:00) bounds for an all-day assignment. */
function dayBounds(date: string): { start: Date; end: Date } {
    const [y, m, d] = date.split('-').map(Number);
    return { start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1) };
}

const memberName = (m: Profile) => [m.first_name, m.last_name].filter(Boolean).join(' ') || m.username;

interface RowState {
    selected: boolean;
    withTime: boolean;
    start: string;
    end: string;
}

export function ScheduledShiftEditor({
    members,
    locations,
    existing = [],
    busy,
    defaultDate,
    defaultLocationId,
    onClose,
    onSubmit,
}: {
    members: Profile[];
    locations: Location[];
    /** Assignments already on this day+location — pre-ticked; unticking removes them. */
    existing?: ScheduledShift[];
    /** userId → "where they're already scheduled that day" (other locations). */
    busy?: Map<string, string>;
    defaultDate: string; // YYYY-MM-DD
    /** Preselected location (the calendar section the day was tapped in). */
    defaultLocationId?: string | null;
    onClose: () => void;
    onSubmit: (values: DayEditorResult) => Promise<void>;
}) {
    const t = useTranslation();
    const pickable = locations.filter((l) => !l.archived_at);
    const existingByUser = new Map(existing.map((e) => [e.user_id, e]));

    // Per-member row state, seeded from the existing assignments.
    const [rows, setRows] = useState<Map<string, RowState>>(() => {
        const map = new Map<string, RowState>();
        for (const e of existing) {
            map.set(e.user_id, {
                selected: true,
                withTime: !e.all_day,
                start: e.all_day ? '08:00' : isoToTime(e.starts_at),
                end: e.all_day ? '16:00' : isoToTime(e.ends_at),
            });
        }
        return map;
    });
    const [locationId, setLocationId] = useState(defaultLocationId ?? pickable[0]?.id ?? '');
    const [date, setDate] = useState(defaultDate);
    const [note, setNote] = useState('');
    const [busyState, setBusyState] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const rowOf = (id: string): RowState => rows.get(id) ?? { selected: false, withTime: false, start: '08:00', end: '16:00' };
    const patchRow = (id: string, patch: Partial<RowState>) =>
        setRows((prev) => {
            const next = new Map(prev);
            next.set(id, { ...rowOf(id), ...patch });
            return next;
        });

    const toISO = (r: RowState) => {
        if (!r.withTime) {
            const b = dayBounds(date);
            return { starts_at: b.start.toISOString(), ends_at: b.end.toISOString(), all_day: true };
        }
        const { startDate, endDate } = buildShiftDates(date, r.start, r.end);
        return { starts_at: startDate.toISOString(), ends_at: endDate.toISOString(), all_day: false };
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
                    (!next.all_day && (isoToTime(prev.starts_at) !== r.start || isoToTime(prev.ends_at) !== r.end));
                if (changed) updated.push({ shift: prev, ...next });
            }
        }
        const removed = existing.filter((e) => !rowOf(e.user_id).selected).map((e) => e.id);

        if (added.length === 0 && removed.length === 0 && updated.length === 0) {
            if (existing.length === 0) return setError(t('schedule.chooseMember'));
            onClose();
            return;
        }

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
                                                title={r.withTime ? t('schedule.allDay') : t('schedule.setTime')}
                                                className={`shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-micro font-bold tabular-nums normal-case tracking-normal transition-colors ${
                                                    r.withTime
                                                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200/70'
                                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                <ClockIcon weight="bold" className="w-3 h-3" />
                                                {r.withTime ? `${r.start}–${r.end}` : t('schedule.allDay')}
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

                <div className="flex gap-2 pt-1">
                    <Button variant="secondary" fullWidth onClick={onClose} disabled={busyState}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" fullWidth loading={busyState} onClick={handleSubmit}>
                        {busyState ? t('common.saving') : t('shiftEditor.saveChanges')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
