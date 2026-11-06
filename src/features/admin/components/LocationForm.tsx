import { useState } from 'react';
import { Modal } from './Modal';
import { Field, TextInput, SelectInput, FormError, FormActions } from './FormControls';
import { useAdminContext } from '../AdminContext';
import { adminService } from '../adminService';
import { useAuthContext } from '@/features/auth/AuthContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { useLocationSettings } from '@features/locations/settings/useLocationSettings';

export interface LocationEditTarget {
    id: string;
    name: string;
    organization_id: string;
    code?: string | null;
}

/**
 * Create or edit a location.
 * Superadmins choose which organization the location belongs to when creating;
 * regular admins always create inside their own organization.
 * When editing, the location's opening hours are set here too — they live in
 * `location_settings`, keyed by the location. The rota uses them as the default
 * shift time and flags shifts planned outside them. (Breaks follow Czech law —
 * see calculateNetHours — so there is no per-location break setting.)
 */
export function LocationForm({ location, onClose }: { location?: LocationEditTarget; onClose: () => void }) {
    const { adminData, isSuperAdmin, createLocation, updateLocation } = useAdminContext();
    const { user } = useAuthContext();
    const t = useTranslation();
    const isEdit = Boolean(location);

    const [name, setName] = useState(location?.name ?? '');
    const [code, setCode] = useState(location?.code ?? '');
    const [organizationId, setOrganizationId] = useState(
        location?.organization_id ?? adminData?.[0]?.id ?? user?.organization_id ?? '',
    );
    const settings = useLocationSettings(user);
    const current = location ? settings.byLocation.get(location.id) : undefined;
    const [openTime, setOpenTime] = useState(current?.open_time?.slice(0, 5) ?? '');
    const [closeTime, setCloseTime] = useState(current?.close_time?.slice(0, 5) ?? '');
    // The settings query may still be loading when the form opens — seed the
    // fields once it lands (adjust-during-render, no effect needed).
    const [seeded, setSeeded] = useState(!settings.list.isLoading);
    if (!seeded && !settings.list.isLoading) {
        setSeeded(true);
        setOpenTime(current?.open_time?.slice(0, 5) ?? '');
        setCloseTime(current?.close_time?.slice(0, 5) ?? '');
    }
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Superadmins can pick the organization — both when creating and when moving
    // an existing location to another org.
    const showOrgSelect = isSuperAdmin && (adminData?.length ?? 0) > 1;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName) return setError(t('admin.locationNameRequired'));
        if (!organizationId) return setError(t('admin.locationOrgRequired'));

        setIsBusy(true);
        setError(null);
        try {
            if (isEdit && location) {
                // Moving a location to another org while someone is clocked in
                // there leaves their shift stranded in the old org (shows up as
                // "Unknown Location"). Block it until the shift is ended.
                const orgChanged = isSuperAdmin && organizationId !== location.organization_id;
                if (orgChanged && (await adminService.hasActiveShiftsAtLocation(location.id))) {
                    setError(t('admin.locationActiveShiftBlock'));
                    setIsBusy(false);
                    return;
                }
                await updateLocation(location.id, {
                    name: trimmedName,
                    code: code.trim() || null,
                    ...(isSuperAdmin ? { organization_id: organizationId } : {}),
                });
                const changed =
                    openTime !== (current?.open_time?.slice(0, 5) ?? '') ||
                    closeTime !== (current?.close_time?.slice(0, 5) ?? '');
                if (changed) {
                    await settings.save.mutateAsync({
                        location_id: location.id,
                        open_time: openTime || null,
                        close_time: closeTime || null,
                    });
                }
            } else {
                await createLocation({ organization_id: organizationId, name: trimmedName, code: code.trim() || null });
            }
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('admin.locationSaveError'));
            setIsBusy(false);
        }
    };

    return (
        <Modal title={isEdit ? t('admin.locationEditTitle') : t('admin.locationNewTitle')} subtitle={t('admin.workplace')} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Field label={t('admin.fieldName')}>
                    <TextInput
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Prague — Main Office"
                        autoFocus
                    />
                </Field>

                {/* Short rota letter, e.g. "D" — shown in grid cells instead of a checkmark. */}
                <Field label={t('admin.fieldCode')}>
                    <TextInput
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 2))}
                        placeholder="D"
                        maxLength={2}
                    />
                </Field>

                {/* Operations — only once the location exists (settings are keyed by it). */}
                {isEdit && (
                    <div className="space-y-2 rounded-xl bg-white/55 p-3 ring-1 ring-ink/5 dark:bg-white/4 dark:ring-white/6">
                        <p className="text-eyebrow text-ink-soft dark:text-slate-400">{t('locset.hours')}</p>
                        <div className="grid grid-cols-2 gap-2">
                            <Field label={t('locset.open')}>
                                <TextInput type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
                            </Field>
                            <Field label={t('locset.close')}>
                                <TextInput type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
                            </Field>
                        </div>
                        <p className="text-caption text-ink-soft dark:text-slate-400">{t('locset.hint')}</p>
                    </div>
                )}

                {showOrgSelect && (
                    <Field label={t('profile.field.organization')}>
                        <SelectInput value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
                            {adminData?.map((org) => (
                                <option key={org.id} value={org.id}>
                                    {org.name}
                                </option>
                            ))}
                        </SelectInput>
                    </Field>
                )}

                <FormError message={error} />
                <FormActions onCancel={onClose} isBusy={isBusy} submitLabel={isEdit ? t('common.save') : t('common.create')} />
            </form>
        </Modal>
    );
}
