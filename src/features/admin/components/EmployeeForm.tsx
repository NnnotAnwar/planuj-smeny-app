import { useState } from 'react';
import { Modal } from './Modal';
import { Field, TextInput, SelectInput, FormError, FormActions } from './FormControls';
import { useAdminContext } from '../AdminContext';
import { useAuthContext } from '@/features/auth/AuthContext';
import { assignableRoles as getAssignableRoles } from '@shared/auth/permissions';
import type { Profile } from '@/shared/types';
import { useTranslation } from '@shared/preferences/PreferencesContext';

/**
 * Edit an employee's name and role.
 *
 * Note: creating an employee is intentionally not here — accounts are created
 * through sign-up/invitation (Supabase Auth), not from the admin client. This
 * form manages the profile + role of users who already exist.
 */
export function EmployeeForm({ employee, onClose }: { employee: Profile; onClose: () => void }) {
    const { adminData, roles, isSuperAdmin, updateEmployee } = useAdminContext();
    const { user } = useAuthContext();
    const t = useTranslation();

    const [firstName, setFirstName] = useState(employee.first_name ?? '');
    const [lastName, setLastName] = useState(employee.last_name ?? '');
    const [role, setRole] = useState(employee.role.name);
    const [organizationId, setOrganizationId] = useState(employee.organization_id);
    const [managerId, setManagerId] = useState(employee.manager_id ?? '');
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Only Superadmins can move a user to another organization.
    const showOrgSelect = isSuperAdmin && (adminData?.length ?? 0) > 1;

    // Managers (rank >= 20) in the member's organization they can report to.
    const managerOptions = (adminData?.find((o) => o.id === employee.organization_id)?.profiles ?? [])
        .filter((p) => p.role.rank >= 20 && p.id !== employee.id)
        .sort((a, b) => (a.first_name ?? a.username).localeCompare(b.first_name ?? b.username));

    // Roles strictly below the current user's rank (e.g. an Admin can assign up
    // to Manager). The edited member always ranks below us, so their current
    // role is already part of this list.
    const roleOptions = user ? getAssignableRoles(roles, user) : [];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsBusy(true);
        setError(null);
        try {
            await updateEmployee(employee.id, {
                first_name: firstName.trim() || null,
                last_name: lastName.trim() || null,
                role,
                manager_id: managerId || null,
                ...(isSuperAdmin ? { organization_id: organizationId } : {}),
            });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('admin.employeeUpdateError'));
            setIsBusy(false);
        }
    };

    return (
        <Modal title={t('admin.editEmployee')} subtitle={employee.email} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <Field label={t('profile.field.firstName')}>
                        <TextInput value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" autoFocus />
                    </Field>
                    <Field label={t('profile.field.lastName')}>
                        <TextInput value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
                    </Field>
                </div>

                <Field label={t('profile.field.role')}>
                    <SelectInput value={role} onChange={(e) => setRole(e.target.value)}>
                        {roleOptions.map((r) => (
                            <option key={r.name} value={r.name}>
                                {r.name}
                                {r.description ? ` — ${r.description}` : ''}
                            </option>
                        ))}
                    </SelectInput>
                </Field>

                <Field label={t('admin.fieldManager')}>
                    <SelectInput value={managerId} onChange={(e) => setManagerId(e.target.value)}>
                        <option value="">—</option>
                        {managerOptions.map((m) => (
                            <option key={m.id} value={m.id}>
                                {[m.first_name, m.last_name].filter(Boolean).join(' ') || m.username}
                            </option>
                        ))}
                    </SelectInput>
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
                <FormActions onCancel={onClose} isBusy={isBusy} submitLabel={t('common.save')} />
            </form>
        </Modal>
    );
}
