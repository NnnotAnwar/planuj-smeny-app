import { z } from 'zod';
import { supabase } from '@shared/api/supabaseClient';
import { AREAS, OrgRoleSchema, type Grants, type OrgRole } from './types';

/**
 * --- ROLES SERVICE ---
 * Organization roles + their permission matrix. RLS: everyone in the org can
 * read them; only the Head Admin writes, presets can't be deleted and the Head
 * Admin preset is locked (enforced in the database).
 */
const SELECT = '*, permissions:org_role_permissions(area, can_read, can_write, can_delete)';

export const rolesService = {
    async list(organizationId: string): Promise<OrgRole[]> {
        const { data, error } = await supabase.from('org_roles').select(SELECT).eq('organization_id', organizationId).order('sort').order('name');
        if (error) throw error;
        return z.array(OrgRoleSchema).parse(data ?? []);
    },

    /** How many members hold each role (role id → count). */
    async memberCounts(organizationId: string): Promise<Record<string, number>> {
        const { data, error } = await supabase.from('profiles').select('org_role_id').eq('organization_id', organizationId);
        if (error) throw error;
        const out: Record<string, number> = {};
        for (const r of data ?? []) if (r.org_role_id) out[r.org_role_id] = (out[r.org_role_id] ?? 0) + 1;
        return out;
    },

    async create(input: { organization_id: string; name: string; color: string; base_role: string; sort: number }, grants: Grants): Promise<string> {
        const { data, error } = await supabase.from('org_roles').insert(input).select('id').single();
        if (error) throw error;
        await rolesService.setGrants(data.id, grants);
        return data.id;
    },

    async update(id: string, patch: { name?: string; color?: string; base_role?: string; sort?: number }) {
        const { error } = await supabase.from('org_roles').update(patch).eq('id', id);
        if (error) throw error;
    },

    async setGrants(roleId: string, grants: Grants) {
        const rows = AREAS.map((area) => ({
            role_id: roleId,
            area,
            can_read: grants[area].read,
            can_write: grants[area].write,
            can_delete: grants[area].delete,
        }));
        const { error } = await supabase.from('org_role_permissions').upsert(rows, { onConflict: 'role_id,area' });
        if (error) throw error;
    },

    async remove(id: string) {
        const { error } = await supabase.from('org_roles').delete().eq('id', id);
        if (error) throw error;
    },
};
