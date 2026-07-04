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
    /** "Works that day" — times are just the day bounds, not shown. */
    all_day: boolean;
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

    /** One planned assignment to insert — each member can have their own times. */
    async createMany(
        orgId: string,
        createdBy: string,
        rows: Array<Pick<ScheduledInput, 'user_id' | 'starts_at' | 'ends_at' | 'all_day'>>,
        common: { location_id: string | null; note?: string | null },
    ): Promise<void> {
        if (rows.length === 0) return;
        const { error } = await supabase.from('scheduled_shifts').insert(
            rows.map((r) => ({
                user_id: r.user_id,
                organization_id: orgId,
                location_id: common.location_id,
                starts_at: r.starts_at,
                ends_at: r.ends_at,
                all_day: r.all_day,
                note: common.note ?? null,
                created_by: createdBy,
            })),
        );
        // 23P01 = the no-overlap exclusion constraint: someone is already
        // scheduled then. Marker string is translated at the form.
        if (error) throw new Error(error.code === '23P01' ? 'SCHEDULE_OVERLAP' : error.message);
    },

    async update(id: string, values: ScheduledInput): Promise<void> {
        const { error } = await supabase
            .from('scheduled_shifts')
            .update({
                user_id: values.user_id,
                location_id: values.location_id,
                starts_at: values.starts_at,
                ends_at: values.ends_at,
                all_day: values.all_day,
                note: values.note ?? null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);
        if (error) throw new Error(error.code === '23P01' ? 'SCHEDULE_OVERLAP' : error.message);
    },

    async remove(id: string): Promise<void> {
        const { error } = await supabase.from('scheduled_shifts').delete().eq('id', id);
        if (error) throw new Error(error.message);
    },

    /** Unassign several rows at once (unticking members in the day editor). */
    async removeMany(ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        const { error } = await supabase.from('scheduled_shifts').delete().in('id', ids);
        if (error) throw new Error(error.message);
    },

    /** Take a free member into (or release one from) the caller's team.
     *  Authorization lives in the claim_member RPC (rank/org/ownership checks). */
    async claimMember(memberId: string, claim: boolean): Promise<void> {
        const { error } = await supabase.rpc('claim_member', { p_member: memberId, p_claim: claim });
        if (error) throw new Error(error.message);
    },

    /** Publish every draft in [startISO, endISO) — members can then see them. */
    async publishMonth(startISO: string, endISO: string): Promise<void> {
        const { error } = await supabase
            .from('scheduled_shifts')
            .update({ published: true })
            .gte('starts_at', startISO)
            .lt('starts_at', endISO)
            .eq('published', false);
        if (error) throw new Error(error.message);
    },

    /** Location rosters for the caller's org: location_id -> member ids. */
    async getRoster(): Promise<Map<string, Set<string>>> {
        const { data, error } = await supabase.from('location_roster').select('location_id, user_id');
        if (error) throw error;
        const map = new Map<string, Set<string>>();
        for (const row of (data ?? []) as { location_id: string; user_id: string }[]) {
            const set = map.get(row.location_id) ?? new Set<string>();
            set.add(row.user_id);
            map.set(row.location_id, set);
        }
        return map;
    },

    async addToRoster(orgId: string, addedBy: string, locationId: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('location_roster')
            .insert({ location_id: locationId, user_id: userId, organization_id: orgId, added_by: addedBy });
        if (error && error.code !== '23505') throw new Error(error.message); // already on the roster = fine
    },

    async removeFromRoster(locationId: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('location_roster')
            .delete()
            .eq('location_id', locationId)
            .eq('user_id', userId);
        if (error) throw new Error(error.message);
    },
};
