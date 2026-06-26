import { useState } from 'react';
import { Modal } from './Modal';
import { Field, TextInput, SelectInput, FormError, FormActions } from './FormControls';
import { useAdminContext } from '../AdminContext';
import { adminService } from '../adminService';
import { useAuthContext } from '@/features/auth/AuthContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';

export interface LocationEditTarget {
    id: string;
    name: string;
    organization_id: string;
}

/**
 * Create or edit a location.
 * Superadmins choose which organization the location belongs to when creating;
 * regular admins always create inside their own organization.
 */
export function LocationForm({ location, onClose }: { location?: LocationEditTarget; onClose: () => void }) {
    const { adminData, isSuperAdmin, createLocation, updateLocation } = useAdminContext();
    const { user } = useAuthContext();
    const t = useTranslation();
    const isEdit = Boolean(location);

    const [name, setName] = useState(location?.name ?? '');
    const [organizationId, setOrganizationId] = useState(
        location?.organization_id ?? adminData?.[0]?.id ?? user?.organization_id ?? '',
    );
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
                    ...(isSuperAdmin ? { organization_id: organizationId } : {}),
                });
            } else {
                await createLocation({ organization_id: organizationId, name: trimmedName });
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
