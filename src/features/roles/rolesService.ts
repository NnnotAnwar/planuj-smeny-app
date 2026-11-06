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
        const { data, error } = await supabase.from('org_roles').select(SELECT).eq('organization_id', organizationId).order('sort', { ascending: false });
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

    /** New roles land at the bottom, just above the default role (DB picks the slot). */
    async create(input: { organization_id: string; name: string; color: string }, grants: Grants): Promise<string> {
        const { data, error } = await supabase.from('org_roles').insert(input).select('id').single();
        if (error) throw error;
        await rolesService.setGrants(data.id, grants);
        return data.id;
    },

    async update(id: string, patch: { name?: string; color?: string }) {
        const { error } = await supabase.from('org_roles').update(patch).eq('id', id);
        if (error) throw error;
    },

    /** Writes only the areas that changed — the DB refuses touching rights you don't hold. */
    async setGrants(roleId: string, grants: Grants, before?: Grants) {
        const rows = AREAS.filter(
            (area) => !before || before[area].read !== grants[area].read || before[area].write !== grants[area].write || before[area].delete !== grants[area].delete,
        ).map((area) => ({
            role_id: roleId,
            area,
            can_read: grants[area].read,
            can_write: grants[area].write,
            can_delete: grants[area].delete,
        }));
        if (rows.length === 0) return;
        const { error } = await supabase.from('org_role_permissions').upsert(rows, { onConflict: 'role_id,area' });
        if (error) throw error;
    },

    /** One step up or down the hierarchy (swaps with the neighbour). */
    async move(id: string, up: boolean) {
        const { error } = await supabase.rpc('move_org_role', { p_role: id, p_up: up });
        if (error) throw error;
    },

    /** Its people move to the default role (DB trigger). */
    async remove(id: string) {
        const { error } = await supabase.from('org_roles').delete().eq('id', id);
        if (error) throw error;
    },
};
