import { useState } from 'react';
import { Modal } from '@features/admin/components/Modal';
import type { Location, Shift, Profile } from '@shared/types';

/**
 * --- SHIFT EDITOR MODAL ---
 * Create or edit a member's shift. Times use the device's local timezone via
 * native datetime-local inputs and are converted to ISO for the API. An "open
 * shift" toggle leaves the end time unset (still running).
 */

export interface ShiftFormValues {
    location_id: string;
    started_at: string; // ISO
    ended_at: string | null; // ISO or null
}

/** ISO -> "YYYY-MM-DDTHH:mm" in local time (for datetime-local inputs). */
function isoToLocalInput(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" (local) -> ISO. */
function localInputToIso(local: string): string {
    return new Date(local).toISOString();
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

    const [locationId, setLocationId] = useState(shift?.location_id ?? pickable[0]?.id ?? '');
    const [start, setStart] = useState(() => isoToLocalInput(shift?.started_at ?? null));
    const [hasEnd, setHasEnd] = useState(() => (isEdit ? !!shift?.ended_at : true));
    const [end, setEnd] = useState(() => isoToLocalInput(shift?.ended_at ?? null));

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        setError(null);
        if (!locationId) return setError('Please choose a location.');
        if (!start) return setError('Please set a start time.');
        if (hasEnd && !end) return setError('Please set an end time, or mark the shift as open.');
        if (hasEnd && end && new Date(end) <= new Date(start)) {
            return setError('The end time must be after the start time.');
        }

        setBusy(true);
        try {
            await onSubmit({
                location_id: locationId,
                started_at: localInputToIso(start),
                ended_at: hasEnd && end ? localInputToIso(end) : null,
            });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save the shift.');
            setBusy(false);
        }
    };

    return (
        <Modal
            title={isEdit ? 'Edit shift' : 'Add shift'}
            subtitle={memberName}
            onClose={onClose}
        >
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

                <div className="space-y-1.5">
                    <label className="text-label text-gray-400">Start</label>
                    <input
                        type="datetime-local"
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        className={inputClass}
                    />
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-label text-gray-400">End</label>
                        <label className="flex items-center gap-2 text-caption text-gray-500 dark:text-gray-400 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!hasEnd}
                                onChange={(e) => setHasEnd(!e.target.checked)}
                                className="accent-emerald-500"
                            />
                            Open shift (no end)
                        </label>
                    </div>
                    <input
                        type="datetime-local"
                        value={end}
                        disabled={!hasEnd}
                        onChange={(e) => setEnd(e.target.value)}
                        className={`${inputClass} disabled:opacity-40`}
                    />
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
