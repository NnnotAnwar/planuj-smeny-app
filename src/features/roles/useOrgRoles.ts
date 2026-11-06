import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@shared/toast/toastStore';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { rolesService } from './rolesService';
import type { Grants } from './types';

export const roleKeys = {
    list: (orgId: string) => ['org-roles', orgId] as const,
    counts: (orgId: string) => ['org-roles', orgId, 'counts'] as const,
};

/**
 * --- useOrgRoles ---
 * An organization's roles (presets + custom), how many people hold each, and
 * the Head Admin's edits. Saving a role also refreshes everyone's profile data
 * (names and colours show on the team list).
 */
export function useOrgRoles(organizationId: string | null | undefined) {
    const t = useTranslation();
    const qc = useQueryClient();
    const orgId = organizationId ?? '';
    const list = useQuery({ queryKey: roleKeys.list(orgId), queryFn: () => rolesService.list(orgId), enabled: !!organizationId });
    const counts = useQuery({ queryKey: roleKeys.counts(orgId), queryFn: () => rolesService.memberCounts(orgId), enabled: !!organizationId });

    const refresh = () => {
        qc.invalidateQueries({ queryKey: ['org-roles', orgId] });
        qc.invalidateQueries({ queryKey: ['admin'] });
    };
    const fail = (e: unknown) => {
        const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? '');
        toast(
            m.includes('org_roles_name_uniq') || m.includes('duplicate') ? t('roles.nameTaken')
            : m.includes('violates foreign key') ? t('roles.inUse')
            : t('roles.error'),
            'error',
        );
    };

    const save = useMutation({
        mutationFn: async (v: { id?: string; name: string; color: string; base_role: string; sort: number; grants: Grants; locked?: boolean }) => {
            if (v.id) {
                await rolesService.update(v.id, v.locked ? { color: v.color } : { name: v.name, color: v.color, base_role: v.base_role, sort: v.sort });
                if (!v.locked) await rolesService.setGrants(v.id, v.grants);
                return v.id;
            }
            return rolesService.create({ organization_id: orgId, name: v.name, color: v.color, base_role: v.base_role, sort: v.sort }, v.grants);
        },
        onSuccess: () => {
            refresh();
            toast(t('roles.saved'), 'success');
        },
        onError: fail,
    });

    const remove = useMutation({
        mutationFn: (id: string) => rolesService.remove(id),
        onSuccess: () => {
            refresh();
            toast(t('roles.deleted'), 'success');
        },
        onError: fail,
    });

    return { list, roles: list.data ?? [], counts: counts.data ?? {}, save, remove };
}
