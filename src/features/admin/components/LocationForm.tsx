import { useState } from 'react';
import { Modal } from './Modal';
import { Field, TextInput, SelectInput, FormError, FormActions } from './FormControls';
import { useAdminContext } from '../AdminContext';
import { useAuthContext } from '@/features/auth/AuthContext';

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
        if (!trimmedName) return setError('Location name is required.');
        if (!organizationId) return setError('An organization is required.');

        setIsBusy(true);
        setError(null);
        try {
            if (isEdit && location) {
                await updateLocation(location.id, {
                    name: trimmedName,
                    ...(isSuperAdmin ? { organization_id: organizationId } : {}),
                });
            } else {
                await createLocation({ organization_id: organizationId, name: trimmedName });
            }
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save location.');
            setIsBusy(false);
        }
    };

    return (
        <Modal title={isEdit ? 'Edit Location' : 'New Location'} subtitle="Workplace" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Name">
                    <TextInput
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Prague — Main Office"
                        autoFocus
                    />
                </Field>

                {showOrgSelect && (
                    <Field label="Organization">
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
                <FormActions onCancel={onClose} isBusy={isBusy} submitLabel={isEdit ? 'Save' : 'Create'} />
            </form>
        </Modal>
    );
}
