import { useState } from 'react';
import { Modal } from './Modal';
import { Field, TextInput, SelectInput, FormError, FormActions } from './FormControls';
import { useAdminContext } from '../AdminContext';
import { useAuthContext } from '@/features/auth/AuthContext';
import { isSuperAdmin as isSuper, rankOf } from '@shared/auth/permissions';
import { useOrgRoles } from '@features/roles/useOrgRoles';
import { useTranslation } from '@shared/preferences/PreferencesContext';

/**
 * Invite a brand-new user by email.
 *
 * Superadmins choose the organization + any role. Org admins always invite into
 * their own organization and cannot grant the Superadmin role (enforced again
 * server-side by the invite-employee Edge Function).
 */
export function InviteEmployeeForm({ onClose }: { onClose: () => void }) {
    const { adminData, isSuperAdmin, inviteEmployee } = useAdminContext();
    const { user } = useAuthContext();
    const t = useTranslation();

    const ownOrgId = user?.organization_id ?? '';

    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [organizationId, setOrganizationId] = useState(adminData?.[0]?.id ?? ownOrgId);
    // The target organization's roles whose LEVEL sits below the inviter's.
    const targetOrg = isSuperAdmin ? organizationId : ownOrgId;
    const orgRoles = useOrgRoles(targetOrg);
    const myRank = user ? (isSuper(user) ? 1000 : rankOf(user)) : -1;
    // Roles below yours, lowest first so the default (Employee) is preselected.
    const roleOptions = orgRoles.roles.filter((r) => r.sort < myRank).sort((a, b) => a.sort - b.sort);
    const [pickedRoleId, setPickedRoleId] = useState('');
    // Default: the lowest role (usually Employee) until one is picked.
    const orgRoleId = roleOptions.some((r) => r.id === pickedRoleId) ? pickedRoleId : (roleOptions[0]?.id ?? '');
    const picked = roleOptions.find((r) => r.id === orgRoleId);
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const showOrgSelect = isSuperAdmin && (adminData?.length ?? 0) > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail.includes('@')) return setError(t('admin.inviteEmailRequired'));

        setIsBusy(true);
        setError(null);
        try {
            await inviteEmployee({
                email: trimmedEmail,
                organization_id: isSuperAdmin ? organizationId : ownOrgId,
                role: picked?.base_role ?? 'Employee',
                org_role_id: orgRoleId || undefined,
                first_name: firstName.trim() || null,
                last_name: lastName.trim() || null,
            });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('admin.inviteSendError'));
            setIsBusy(false);
        }
    };

    return (
        <Modal title={t('admin.inviteEmployee')} subtitle={t('admin.inviteSubtitle')} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Field label={t('profile.field.email')}>
                    <TextInput
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="new.member@company.com"
                        autoFocus
                    />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                    <Field label={t('profile.field.firstName')}>
                        <TextInput value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
                    </Field>
                    <Field label={t('profile.field.lastName')}>
                        <TextInput value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
                    </Field>
                </div>

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

                <Field label={t('profile.field.role')}>
                    <SelectInput value={orgRoleId} onChange={(e) => setPickedRoleId(e.target.value)}>
                        {roleOptions.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.name}
                            </option>
                        ))}
                    </SelectInput>
                </Field>

                <FormError message={error} />
                <FormActions onCancel={onClose} isBusy={isBusy} submitLabel={t('admin.sendInvite')} />
            </form>
        </Modal>
    );
}
