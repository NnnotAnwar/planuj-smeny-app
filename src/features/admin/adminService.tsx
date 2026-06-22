import { supabase } from "@/shared/api/supabaseClient";
import {
    type Shift,
    type Organization,
    type Role,
    OrganizationSchema,
    ShiftSchema,
    RoleSchema,
    type User,
} from '@shared/types';
import { z } from 'zod';

/**
 * --- ADMIN SERVICE ---
 * All direct Supabase communication for the Admin Panel lives here.
 * Components/hooks never talk to Supabase directly — they go through this service.
 *
 * Note on permissions: Superadmins have full (RLS) access to every organization.
 * Org-scoped admins (Admin/Manager) can manage their own organization once the
 * companion migration `*_admin_org_management.sql` is applied.
 */

// Shared select used to hydrate the full organization tree (locations + members).
const ORG_TREE_SELECT =
    '*, locations(id, name, organization_id, archived_at), profiles(id, role(name, is_admin, rank), email, username, first_name, last_name, organization_id)';

export interface EmployeeUpdate {
    first_name: string | null;
    last_name: string | null;
    role: string;
    organization_id?: string;
}

export interface EmployeeInvite {
    email: string;
    organization_id: string;
    role: string;
    first_name?: string | null;
    last_name?: string | null;
}

export const adminService = {
    // ----------------------------------------------------------------
    // READS
    // ----------------------------------------------------------------

    /**
     * Fetches the organization tree. Superadmins get every organization;
     * regular admins only get their own.
     */
    async getAdminData(isSuperAdmin: boolean, user: User): Promise<Organization[]> {
        const query = isSuperAdmin
            ? supabase.from('organizations').select(ORG_TREE_SELECT)
            : supabase.from('organizations').select(ORG_TREE_SELECT).eq('id', user.organization_id);

        const { data, error } = await query;
        if (error) throw error;
        return z.array(OrganizationSchema).parse(data ?? []);
    },

    /** Fetches all assignable roles (admin roles first, then alphabetical). */
    async getRoles(): Promise<Role[]> {
        const { data, error } = await supabase
            .from('roles')
            .select('name, color, description, is_admin, rank')
            .order('rank', { ascending: false })
            .order('name', { ascending: true });

        if (error) throw error;
        return z.array(RoleSchema).parse(data ?? []);
    },

    async getAllActiveShifts(organizationId: string, isSuperAdmin: boolean): Promise<Shift[]> {
        let query = supabase
            .from('shifts')
            .select('*, profiles(username, first_name, last_name)')
            .is('ended_at', null);

        if (!isSuperAdmin) {
            query = query.eq('organization_id', organizationId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return z.array(ShiftSchema).parse(data ?? []);
    },

    // ----------------------------------------------------------------
    // ORGANIZATIONS (Superadmin only)
    // ----------------------------------------------------------------

    async createOrganization(name: string, slug: string): Promise<void> {
        const { error } = await supabase.from('organizations').insert({ name, slug });
        if (error) throw error;
    },

    async updateOrganization(id: string, values: { name: string; slug: string }): Promise<void> {
        const { error } = await supabase.from('organizations').update(values).eq('id', id);
        if (error) throw error;
    },

    async deleteOrganization(id: string): Promise<void> {
        const { error } = await supabase.from('organizations').delete().eq('id', id);
        if (error) throw error;
    },

    // ----------------------------------------------------------------
    // LOCATIONS
    // ----------------------------------------------------------------

    async createLocation(values: { organization_id: string; name: string }): Promise<void> {
        const { error } = await supabase.from('locations').insert(values);
        if (error) throw error;
    },

    async updateLocation(id: string, name: string): Promise<void> {
        const { error } = await supabase.from('locations').update({ name }).eq('id', id);
        if (error) throw error;
    },

    /**
     * "Deletes" a location by archiving it (soft delete). Hard-deleting would
     * CASCADE-remove every shift there — wiping active shifts and payroll
     * history. Archiving hides it from pickers/admin while keeping all history,
     * and is what the realtime subscription propagates to dashboards.
     */
    async deleteLocation(id: string): Promise<void> {
        const { error } = await supabase
            .from('locations')
            .update({ archived_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },

    // ----------------------------------------------------------------
    // EMPLOYEES (profiles)
    // ----------------------------------------------------------------

    async updateEmployee(id: string, values: EmployeeUpdate): Promise<void> {
        const { error } = await supabase.from('profiles').update(values).eq('id', id);
        if (error) throw error;
    },

    /**
     * Fully removes a member via the `delete-employee` Edge Function, which
     * deletes the auth.users row (cascades to profiles + shifts) using the
     * service_role and enforces caller > target rank. Deleting only the profiles
     * row client-side left an orphaned, still-loggable auth user.
     */
    async deleteEmployee(id: string): Promise<void> {
        const { error } = await supabase.functions.invoke('delete-employee', {
            body: { user_id: id },
        });
        if (error) throw await toFunctionError(error);
    },

    /**
     * Invites a new user by email via the `invite-employee` Edge Function.
     * The function enforces role/organization scoping based on the caller.
     */
    async inviteEmployee(payload: EmployeeInvite): Promise<void> {
        const redirect_to = `${window.location.origin}/accept-invite`;
        const { error } = await supabase.functions.invoke('invite-employee', {
            body: { ...payload, redirect_to },
        });
        if (error) throw await toFunctionError(error);
    },
};

/**
 * Edge Functions return their error body with a non-2xx status, which supabase-js
 * surfaces as a FunctionsHttpError whose `context` is the raw Response. Pull the
 * server's `error` message out of it so the UI can show something meaningful.
 */
async function toFunctionError(error: unknown): Promise<Error> {
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
        try {
            const body = await context.json();
            if (body?.error) return new Error(body.error);
        } catch {
            // fall through to the generic message
        }
    }
    return error instanceof Error ? error : new Error('Failed to send invitation.');
}
