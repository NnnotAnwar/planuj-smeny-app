import { supabase } from '@shared/api/supabaseClient';
import { z } from 'zod';
import { type User } from '@shared/types';
import { AvailabilitySchema, type Availability, type AvailabilityInput } from './types';

/**
 * --- AVAILABILITY SERVICE ---
 * The only place that talks to `availability`. Members manage their own entries;
 * managers read the org's (RLS enforces both). Components use useAvailability.
 */
const SELECT_WITH_PROFILE = '*, profiles(username, first_name, last_name)';

export const availabilityService = {
  /** The current member's own availability entries. */
  async getMine(userId: string): Promise<Availability[]> {
    const { data, error } = await supabase
      .from('availability')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return z.array(AvailabilitySchema).parse(data ?? []);
  },

  /** Everyone's availability in an org (manager planning view). */
  async getForOrg(organizationId: string): Promise<Availability[]> {
    const { data, error } = await supabase
      .from('availability')
      .select(SELECT_WITH_PROFILE)
      .eq('organization_id', organizationId);
    if (error) throw error;
    return z.array(AvailabilitySchema).parse(data ?? []);
  },

  async create(user: User, input: AvailabilityInput): Promise<Availability> {
    const { data, error } = await supabase
      .from('availability')
      .insert({
        user_id: user.id,
        organization_id: user.organization_id,
        kind: input.kind ?? 'unavailable',
        day_of_week: input.day_of_week ?? null,
        specific_date: input.specific_date ?? null,
        all_day: input.all_day ?? true,
        start_time: input.start_time ?? null,
        end_time: input.end_time ?? null,
        note: input.note ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return AvailabilitySchema.parse(data);
  },

  async update(id: string, patch: Partial<AvailabilityInput>): Promise<Availability> {
    const { data, error } = await supabase
      .from('availability')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return AvailabilitySchema.parse(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('availability').delete().eq('id', id);
    if (error) throw error;
  },
};
