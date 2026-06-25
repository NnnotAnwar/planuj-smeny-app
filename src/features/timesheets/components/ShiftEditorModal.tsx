import { useState } from 'react';
import { Modal } from '@features/admin/components/Modal';
import { TimePicker } from '@shared/components/TimePicker';
import { DatePicker } from '@shared/components/DatePicker';
import type { Location, Shift, Profile } from '@shared/types';

/**
 * --- SHIFT EDITOR MODAL ---
 * Create or edit a member's shift. Start/end *times* use a custom {@link TimePicker}.
 * When EDITING, the date is held fixed (you only correct the times of an existing
 * shift); when ADDING, the day is chosen with a custom {@link DatePicker} so an
 * admin can backdate a shift to the day actually worked. A shift always has a
 * start and an end. Times use the device's local timezone, converted to ISO.
 */

export interface ShiftFormValues {
    location_id: string;
    started_at: string; // ISO
    ended_at: string | null; // ISO (always set — shifts are never left open here)
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO -> local "YYYY-MM-DD". */
function isoToDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ISO -> local "HH:mm". */
function isoToTime(iso: string): string {
    const d = new Date(iso);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** local "YYYY-MM-DD" + "HH:mm" -> ISO. */
function combine(date: string, time: string): string {
    return new Date(`${date}T${time}:00`).toISOString();
}

/** Human-readable fixed date, e.g. "Mon, 24 Jun 2026". */
function prettyDate(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

const inputClass =
    'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-body text-gray-900 dark:text-white outline-none focus:border-emerald-500 transition-colors';

export function ShiftEditorModal({
    member,
    shift,
    locations,
    onClose,
    onSubmit,
}: {
    member: Profile;
    shift?: Shift | null;
    locations: Location[];
    onClose: () => void;
    onSubmit: (values: ShiftFormValues) => Promise<void>;
}) {
    const isEdit = !!shift;
    const memberName =
        [member.first_name, member.last_name].filter(Boolean).join(' ') || member.username;

    // Active locations + keep the shift's current one even if it was archived.
    const pickable = locations.filter((l) => !l.archived_at || l.id === shift?.location_id);

    // Editing keeps the shift's own date fixed; adding lets you pick the day.
    const [date, setDate] = useState(() =>
        shift ? isoToDate(shift.started_at) : isoToDate(new Date().toISOString()),
    );

    const [locationId, setLocationId] = useState(shift?.location_id ?? pickable[0]?.id ?? '');
    const [start, setStart] = useState(() => (shift ? isoToTime(shift.started_at) : '08:00'));
    const [end, setEnd] = useState(() =>
        shift?.ended_at ? isoToTime(shift.ended_at) : shift ? isoToTime(shift.started_at) : '16:00',
    );

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        setError(null);
        if (!locationId) return setError('Please choose a location.');
        if (end <= start) return setError('The end time must be after the start time.');

        setBusy(true);
        try {
            await onSubmit({
                location_id: locationId,
                started_at: combine(date, start),
                ended_at: combine(date, end),
            });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save the shift.');
            setBusy(false);
        }
    };

    return (
        <Modal title={isEdit ? 'Edit shift' : 'Add shift'} subtitle={memberName} onClose={onClose}>
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-label text-gray-400">Location</label>
                    <select
                        value={locationId}
                        onChange={(e) => setLocationId(e.target.value)}
                        className={inputClass}
                    >
                        {pickable.length === 0 && <option value="">No locations</option>}
                        {pickable.map((l) => (
                            <option key={l.id} value={l.id}>
                                {l.name}
                                {l.archived_at ? ' (archived)' : ''}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Editing: fixed date (only times change). Adding: pick the day. */}
                <div className="space-y-1.5">
                    <label className="text-label text-gray-400">Date</label>
                    {isEdit ? (
                        <div className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800/50 px-3 py-2.5">
                            <span className="text-small-strong text-gray-700 dark:text-gray-200">{prettyDate(date)}</span>
                            <span className="text-micro text-gray-400">fixed</span>
                        </div>
                    ) : (
                        <DatePicker value={date} onChange={setDate} aria-label="Shift date" />
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-label text-gray-400">Start</label>
                        <TimePicker value={start} onChange={setStart} aria-label="Start time" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-label text-gray-400">End</label>
                        <TimePicker value={end} onChange={setEnd} aria-label="End time" />
                    </div>
                </div>

                {error && (
                    <p className="text-small-strong text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">
                        {error}
                    </p>
                )}

                <div className="flex gap-2 pt-1">
                    <button
                        onClick={onClose}
                        disabled={busy}
                        className="flex-1 px-4 py-2.5 rounded-xl text-label text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={busy}
                        className="flex-1 px-4 py-2.5 rounded-xl text-label text-white bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-60 shadow-lg shadow-emerald-500/20"
                    >
                        {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add shift'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
