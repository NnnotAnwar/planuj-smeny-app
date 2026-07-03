import { supabase } from '@shared/api/supabaseClient';
import { z } from 'zod';
import { ScheduledShiftSchema, type ScheduledShift } from '@shared/types';

/**
 * --- SCHEDULE SERVICE ---
 * Data access for planned shifts (the rota). RLS scopes reads automatically:
 * a member only sees their own rows, a manager sees their whole organization.
 */

export interface ScheduledInput {
    user_id: string;
    location_id: string | null;
    starts_at: string; // ISO
    ends_at: string; // ISO
    note?: string | null;
}

// Embed the member profile via the user_id FK for the manager's roster view.
const SELECT = '*, profiles:user_id(username, first_name, last_name)';

export const scheduleService = {
    /** Planned shifts overlapping [startISO, endISO). */
    async getRange(startISO: string, endISO: string): Promise<ScheduledShift[]> {
        const { data, error } = await supabase
            .from('scheduled_shifts')
            .select(SELECT)
            .gte('starts_at', startISO)
            .lt('starts_at', endISO)
            .order('starts_at', { ascending: true });
        if (error) throw error;
        return z.array(ScheduledShiftSchema).parse(data ?? []);
    },

    async create(orgId: string, createdBy: string, input: ScheduledInput): Promise<void> {
        const { error } = await supabase.from('scheduled_shifts').insert({
            user_id: input.user_id,
            organization_id: orgId,
            location_id: input.location_id,
            starts_at: input.starts_at,
            ends_at: input.ends_at,
            note: input.note ?? null,
            created_by: createdBy,
        });
        if (error) throw new Error(error.message);
    },

    async update(id: string, values: ScheduledInput): Promise<void> {
        const { error } = await supabase
            .from('scheduled_shifts')
            .update({
                user_id: values.user_id,
                location_id: values.location_id,
                starts_at: values.starts_at,
                ends_at: values.ends_at,
                note: values.note ?? null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);
        if (error) throw new Error(error.message);
    },

    async remove(id: string): Promise<void> {
        const { error } = await supabase.from('scheduled_shifts').delete().eq('id', id);
        if (error) throw new Error(error.message);
    },
};
