import { useState } from 'react';
import { Modal } from './Modal';
import { Field, TextInput, SelectInput, FormError, FormActions } from './FormControls';
import { useAdminContext } from '../AdminContext';
import { useAuthContext } from '@/features/auth/AuthContext';
import { assignableRoles as getAssignableRoles } from '@shared/auth/permissions';
import type { Profile } from '@/shared/types';

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

    const [firstName, setFirstName] = useState(employee.first_name ?? '');
    const [lastName, setLastName] = useState(employee.last_name ?? '');
    const [role, setRole] = useState(employee.role.name);
    const [organizationId, setOrganizationId] = useState(employee.organization_id);
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Only Superadmins can move a user to another organization.
    const showOrgSelect = isSuperAdmin && (adminData?.length ?? 0) > 1;

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
                ...(isSuperAdmin ? { organization_id: organizationId } : {}),
            });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not update employee.');
            setIsBusy(false);
        }
    };

    return (
        <Modal title="Edit Employee" subtitle={employee.email} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <Field label="First name">
                        <TextInput value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" autoFocus />
                    </Field>
                    <Field label="Last name">
                        <TextInput value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
                    </Field>
                </div>

                <Field label="Role">
                    <SelectInput value={role} onChange={(e) => setRole(e.target.value)}>
                        {roleOptions.map((r) => (
                            <option key={r.name} value={r.name}>
                                {r.name}
                                {r.description ? ` — ${r.description}` : ''}
                            </option>
                        ))}
                    </SelectInput>
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
                <FormActions onCancel={onClose} isBusy={isBusy} submitLabel="Save" />
            </form>
        </Modal>
    );
}
