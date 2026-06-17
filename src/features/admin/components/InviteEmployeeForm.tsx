import { useState } from 'react';
import { Modal } from './Modal';
import { Field, TextInput, SelectInput, FormError, FormActions } from './FormControls';
import { useAdminContext } from '../AdminContext';
import { useAuthContext } from '@/features/auth/AuthContext';
import { assignableRoles as getAssignableRoles } from '../permissions';

/**
 * Invite a brand-new user by email.
 *
 * Superadmins choose the organization + any role. Org admins always invite into
 * their own organization and cannot grant the Superadmin role (enforced again
 * server-side by the invite-employee Edge Function).
 */
export function InviteEmployeeForm({ onClose }: { onClose: () => void }) {
    const { adminData, roles, isSuperAdmin, inviteEmployee } = useAdminContext();
    const { user } = useAuthContext();

    const ownOrgId = user?.organization_id ?? '';
    // Roles strictly below the inviter's rank (Admin -> up to Manager, etc.).
    const roleOptions = user ? getAssignableRoles(roles, user) : [];

    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [role, setRole] = useState('Employee');
    const [organizationId, setOrganizationId] = useState(adminData?.[0]?.id ?? ownOrgId);
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const showOrgSelect = isSuperAdmin && (adminData?.length ?? 0) > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail.includes('@')) return setError('A valid email is required.');

        setIsBusy(true);
        setError(null);
        try {
            await inviteEmployee({
                email: trimmedEmail,
                organization_id: isSuperAdmin ? organizationId : ownOrgId,
                role,
                first_name: firstName.trim() || null,
                last_name: lastName.trim() || null,
            });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not send the invitation.');
            setIsBusy(false);
        }
    };

    return (
        <Modal title="Invite Employee" subtitle="Email invitation" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Email">
                    <TextInput
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="new.member@company.com"
                        autoFocus
                    />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="First name">
                        <TextInput value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
                    </Field>
                    <Field label="Last name">
                        <TextInput value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
                    </Field>
                </div>

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

                <FormError message={error} />
                <FormActions onCancel={onClose} isBusy={isBusy} submitLabel="Send invite" />
            </form>
        </Modal>
    );
}
