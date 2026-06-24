import { supabase } from '@shared/api/supabaseClient';
import {
    type Shift,
    type Profile,
    type Location,
    type ShiftAuditLog,
    ShiftSchema,
    ProfileSchema,
    LocationSchema,
    ShiftAuditLogSchema,
} from '@shared/types';
import { z } from 'zod';

/**
 * --- TIMESHEET SERVICE ---
 * Data access for the Timesheets surface (managers+) and the Activity Log
 * (admins+). All administrative writes go through SECURITY DEFINER RPCs
 * (`admin_*_shift`) which enforce the rank/org rules and write the audit log
 * atomically — the client never UPDATEs `shifts` for other members directly.
 */

const MEMBER_SELECT =
    'id, username, first_name, last_name, email, role(name, is_admin, rank), organization_id, username_changed_at';

export interface ShiftInput {
    user_id: string;
    location_id: string;
    started_at: string; // ISO
    ended_at: string | null; // ISO or null (open shift)
    role?: string | null;
}

export const timesheetService = {
    /**
     * Org members the caller can see (RLS scopes to their organization;
     * Superadmin sees everyone). Sorted by name for the picker.
     */
    async getMembers(): Promise<Profile[]> {
        const { data, error } = await supabase
            .from('profiles')
            .select(MEMBER_SELECT)
            .order('first_name', { ascending: true })
            .order('username', { ascending: true });

        if (error) throw error;
        return z.array(ProfileSchema).parse(data ?? []);
    },

    /**
     * Locations for one organization (incl. archived, so historical shift names
     * still resolve). The editor's picker filters archived ones out itself.
     */
    async getOrgLocations(organizationId: string): Promise<Location[]> {
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .eq('organization_id', organizationId)
            .order('name', { ascending: true });

        if (error) throw error;
        return z.array(LocationSchema).parse(data ?? []);
    },

    /** Every shift for one member, newest first. Filtering by month is done in the UI. */
    async getMemberShifts(userId: string): Promise<Shift[]> {
        const { data, error } = await supabase
            .from('shifts')
            .select('*')
            .eq('user_id', userId)
            .order('started_at', { ascending: false });

        if (error) throw error;
        return z.array(ShiftSchema).parse(data ?? []);
    },

    /** Create a shift for a member (RPC enforces authorization + audits). */
    async createShift(input: ShiftInput): Promise<void> {
        const { error } = await supabase.rpc('admin_create_shift', {
            p_user_id: input.user_id,
            p_location_id: input.location_id,
            p_started_at: input.started_at,
            p_ended_at: input.ended_at,
            p_role: input.role ?? null,
        });
        if (error) throw new Error(error.message);
    },

    /** Update a member's shift. */
    async updateShift(
        shiftId: string,
        values: { started_at: string; ended_at: string | null; location_id: string },
    ): Promise<void> {
        const { error } = await supabase.rpc('admin_update_shift', {
            p_shift_id: shiftId,
            p_started_at: values.started_at,
            p_ended_at: values.ended_at,
            p_location_id: values.location_id,
        });
        if (error) throw new Error(error.message);
    },

    /** Delete a member's shift. */
    async deleteShift(shiftId: string): Promise<void> {
        const { error } = await supabase.rpc('admin_delete_shift', { p_shift_id: shiftId });
        if (error) throw new Error(error.message);
    },

    /** Most recent administrative shift changes for the Activity Log (admins+). */
    async getAuditLog(limit = 200): Promise<ShiftAuditLog[]> {
        const { data, error } = await supabase
            .from('shift_audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return z.array(ShiftAuditLogSchema).parse(data ?? []);
    },
};
