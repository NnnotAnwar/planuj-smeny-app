import { useState } from 'react';
import { Modal } from './Modal';
import { Field, TextInput, SelectInput, FormError, FormActions } from './FormControls';
import { useAdminContext } from '../AdminContext';
import { useAuthContext } from '@/features/auth/AuthContext';
import { canSetWageOf, isSuperAdmin as isSuper, rankOf } from '@shared/auth/permissions';
import { useOrgRoles } from '@features/roles/useOrgRoles';
import { Input } from '@shared/components/Input';
import type { Profile } from '@/shared/types';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { useWages } from '@features/wages/useWages';

/**
 * Edit an employee's name, role and (for people below you) hourly rate. The
 * rate is private: RLS lets only the member and the people above them read it.
 *
 * Note: creating an employee is intentionally not here — accounts are created
 * through sign-up/invitation (Supabase Auth), not from the admin client. This
 * form manages the profile + role of users who already exist.
 */
export function EmployeeForm({ employee, onClose }: { employee: Profile; onClose: () => void }) {
    const { adminData, isSuperAdmin, updateEmployee } = useAdminContext();
    const { user } = useAuthContext();
    const t = useTranslation();

    const [firstName, setFirstName] = useState(employee.first_name ?? '');
    const [lastName, setLastName] = useState(employee.last_name ?? '');
    const [orgRoleId, setOrgRoleId] = useState(employee.org_role_id ?? '');
    const [organizationId, setOrganizationId] = useState(employee.organization_id);
    const [managerId, setManagerId] = useState(employee.manager_id ?? '');
    // Hourly rate — admins only, for someone strictly below them (RLS enforces the same).
    const canSetRate = !!user && canSetWageOf(user, employee);
    const wages = useWages(canSetRate ? user : null);
    const currentRate = wages.org.data?.find((w) => w.user_id === employee.id);
    const [rate, setRate] = useState(currentRate ? String(currentRate.hourly_rate) : '');
    // The rates query may land after the form opens — seed the field once.
    const [rateSeeded, setRateSeeded] = useState(!wages.org.isLoading);
    if (!rateSeeded && !wages.org.isLoading) {
        setRateSeeded(true);
        setRate(currentRate ? String(currentRate.hourly_rate) : '');
    }
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Only Superadmins can move a user to another organization.
    const showOrgSelect = isSuperAdmin && (adminData?.length ?? 0) > 1;

    // Managers (rank >= 20) in the member's organization they can report to.
    const managerOptions = (adminData?.find((o) => o.id === employee.organization_id)?.profiles ?? [])
        .filter((p) => p.role.rank >= 20 && p.id !== employee.id)
        .sort((a, b) => (a.first_name ?? a.username).localeCompare(b.first_name ?? b.username));

    // The organization's roles BELOW yours in the hierarchy (top → bottom).
    // The member's current role stays listed so the form opens on it.
    const orgRoles = useOrgRoles(employee.organization_id);
    const myRank = user ? (isSuper(user) ? 1000 : rankOf(user)) : -1;
    const roleOptions = orgRoles.roles.filter((r) => r.sort < myRank || r.id === employee.org_role_id);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsBusy(true);
        setError(null);
        try {
            await updateEmployee(employee.id, {
                first_name: firstName.trim() || null,
                last_name: lastName.trim() || null,
                ...(orgRoleId && orgRoleId !== employee.org_role_id ? { org_role_id: orgRoleId } : {}),
                manager_id: managerId || null,
                ...(isSuperAdmin ? { organization_id: organizationId } : {}),
            });
            const nextRate = rate.trim() === '' ? null : Number(rate.replace(',', '.'));
            if (canSetRate && nextRate !== null && Number.isFinite(nextRate) && nextRate >= 0 && nextRate !== currentRate?.hourly_rate) {
                await wages.setRate.mutateAsync({ user_id: employee.id, hourly_rate: Math.round(nextRate * 100) / 100 });
            }
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
                    <SelectInput value={orgRoleId} onChange={(e) => setOrgRoleId(e.target.value)}>
                        {roleOptions.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.name}
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

                {canSetRate && (
                    <div className="space-y-1">
                        <Field label={t('wage.rate')}>
                            <Input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step={1}
                                value={rate}
                                onChange={(e) => setRate(e.target.value)}
                                placeholder="0"
                                trailing={<span className="pr-1 text-meta text-ink-soft dark:text-slate-400">{currentRate?.currency ?? 'CZK'}/h</span>}
                            />
                        </Field>
                        <p className="text-caption text-ink-soft dark:text-slate-400">{t('wage.rateHint')}</p>
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
                <FormActions onCancel={onClose} isBusy={isBusy} submitLabel={t('common.save')} />
            </form>
        </Modal>
    );
}
