import { useState } from 'react';
import { Modal } from '@features/admin/components/Modal';
import { TimePicker } from '@shared/components/TimePicker';
import { DatePicker } from '@shared/components/DatePicker';
import { Select } from '@shared/components/Select';
import type { Location, Shift, Profile } from '@shared/types';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { buildShiftDates } from '../shiftTimes';

/**
 * --- SHIFT EDITOR MODAL ---
 * Create or edit a member's shift. The start day is chosen with a custom
 * {@link DatePicker} and the start/end times with a custom {@link TimePicker}
 * (no native pickers). An end time on/before the start is treated as an overnight
 * shift (rolls to the next day). A shift always has a start and an end; times use
 * the device's local timezone, converted to ISO.
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
    const t = useTranslation();
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

    // End on/before start means the shift runs past midnight → ends next day.
    const overnight = end <= start;

    const handleSubmit = async () => {
        setError(null);
        if (!locationId) return setError(t('shiftEditor.chooseLocation'));

        const { startDate, endDate } = buildShiftDates(date, start, end);

        setBusy(true);
        try {
            await onSubmit({
                location_id: locationId,
                started_at: startDate.toISOString(),
                ended_at: endDate.toISOString(),
            });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('shiftEditor.saveError'));
            setBusy(false);
        }
    };

    return (
        <Modal title={isEdit ? t('shiftEditor.editTitle') : t('shiftEditor.addTitle')} subtitle={memberName} onClose={onClose}>
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-label text-gray-400">{t('admin.colLocation')}</label>
                    <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                        {pickable.length === 0 && <option value="">{t('shiftEditor.noLocations')}</option>}
                        {pickable.map((l) => (
                            <option key={l.id} value={l.id}>
                                {l.name}
                                {l.archived_at ? t('shiftEditor.archived') : ''}
                            </option>
                        ))}
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <label className="text-label text-gray-400">{t('overview.colDate')}</label>
                    <DatePicker value={date} onChange={setDate} aria-label={t('shiftEditor.shiftDate')} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-label text-gray-400">{t('shiftEditor.start')}</label>
                        <TimePicker value={start} onChange={setStart} aria-label={t('shiftEditor.startTime')} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-label text-gray-400">{t('shiftEditor.end')}</label>
                        <TimePicker value={end} onChange={setEnd} aria-label={t('shiftEditor.endTime')} />
                        {overnight && <p className="text-micro text-amber-500">{t('shiftEditor.overnight')}</p>}
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
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={busy}
                        className="flex-1 px-4 py-2.5 rounded-xl text-label text-white bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-60 shadow-lg shadow-emerald-500/20"
                    >
                        {busy ? t('common.saving') : isEdit ? t('shiftEditor.saveChanges') : t('shiftEditor.addTitle')}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
