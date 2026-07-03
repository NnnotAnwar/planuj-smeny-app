import { useState } from 'react';
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
 * --- SCHEDULED SHIFT EDITOR ---
 * Create or edit a planned shift for a member. Same custom date/time pickers as
 * the timesheet editor; an end time on/before the start rolls to the next day.
 */

export interface ScheduledFormValues {
    user_id: string;
    location_id: string | null;
    starts_at: string; // ISO
    ends_at: string; // ISO
    note: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoToDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const isoToTime = (iso: string) => {
    const d = new Date(iso);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function ScheduledShiftEditor({
    members,
    locations,
    shift,
    defaultDate,
    onClose,
    onSubmit,
}: {
    members: Profile[];
    locations: Location[];
    shift?: ScheduledShift | null;
    defaultDate: string; // YYYY-MM-DD
    onClose: () => void;
    onSubmit: (values: ScheduledFormValues) => Promise<void>;
}) {
    const t = useTranslation();
    const isEdit = !!shift;
    const pickable = locations.filter((l) => !l.archived_at || l.id === shift?.location_id);

    const [userId, setUserId] = useState(shift?.user_id ?? members[0]?.id ?? '');
    const [locationId, setLocationId] = useState(shift?.location_id ?? pickable[0]?.id ?? '');
    const [date, setDate] = useState(shift ? isoToDate(shift.starts_at) : defaultDate);
    const [start, setStart] = useState(shift ? isoToTime(shift.starts_at) : '08:00');
    const [end, setEnd] = useState(shift ? isoToTime(shift.ends_at) : '16:00');
    const [note, setNote] = useState(shift?.note ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const overnight = end <= start;
    const memberName = (m: Profile) => [m.first_name, m.last_name].filter(Boolean).join(' ') || m.username;

    const handleSubmit = async () => {
        setError(null);
        if (!userId) return setError(t('schedule.chooseMember'));
        const { startDate, endDate } = buildShiftDates(date, start, end);
        setBusy(true);
        try {
            await onSubmit({
                user_id: userId,
                location_id: locationId || null,
                starts_at: startDate.toISOString(),
                ends_at: endDate.toISOString(),
                note: note.trim() || null,
            });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('common.actionFailed'));
            setBusy(false);
        }
    };

    return (
        <Modal title={isEdit ? t('schedule.editTitle') : t('schedule.addTitle')} onClose={onClose}>
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-label text-gray-400">{t('schedule.member')}</label>
                    <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
                        {members.length === 0 && <option value="">—</option>}
                        {members.map((m) => (
                            <option key={m.id} value={m.id}>
                                {memberName(m)}
                            </option>
                        ))}
                    </Select>
                </div>

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

                <div className="space-y-1.5">
                    <label className="text-label text-gray-400">{t('schedule.note')}</label>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t('schedule.notePlaceholder')} />
                </div>

                <FormError message={error} />

                <div className="flex gap-2 pt-1">
                    <Button variant="secondary" fullWidth onClick={onClose} disabled={busy}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" fullWidth loading={busy} onClick={handleSubmit}>
                        {busy ? t('common.saving') : isEdit ? t('shiftEditor.saveChanges') : t('schedule.addTitle')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
