import { supabase } from '@shared/api/supabaseClient';
import { z } from 'zod';
import { type User } from '@shared/types';
import { OpenShiftSchema, type OpenShift, type OpenShiftInput } from './types';

const SELECT_WITH_CLAIMER = '*, claimer:profiles!open_shifts_claimed_by_fkey(username, first_name, last_name)';

/** Data access for open (claimable) shifts. RLS enforces who can post / claim. */
export const openShiftService = {
  async getForOrg(organizationId: string): Promise<OpenShift[]> {
    const { data, error } = await supabase
      .from('open_shifts')
      .select(SELECT_WITH_CLAIMER)
      .eq('organization_id', organizationId)
      .order('starts_at', { ascending: true });
    if (error) throw error;
    return z.array(OpenShiftSchema).parse(data ?? []);
  },

  async create(user: User, input: OpenShiftInput): Promise<OpenShift> {
    const { data, error } = await supabase
      .from('open_shifts')
      .insert({
        organization_id: user.organization_id,
        created_by: user.id,
        location_id: input.location_id,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        role: input.role ?? null,
        note: input.note ?? null,
      })
      .select(SELECT_WITH_CLAIMER)
      .single();
    if (error) throw error;
    return OpenShiftSchema.parse(data);
  },

  /** Claim an unclaimed open shift for the current member. */
  async claim(user: User, id: string): Promise<OpenShift> {
    const { data, error } = await supabase
      .from('open_shifts')
      .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq('id', id)
      .is('claimed_by', null) // first-come: only if still open
      .select(SELECT_WITH_CLAIMER)
      .single();
    if (error) throw error;
    return OpenShiftSchema.parse(data);
  },

  /** Release a claim (the claimer or a manager). */
  async release(id: string): Promise<OpenShift> {
    const { data, error } = await supabase
      .from('open_shifts')
      .update({ claimed_by: null, claimed_at: null })
      .eq('id', id)
      .select(SELECT_WITH_CLAIMER)
      .single();
    if (error) throw error;
    return OpenShiftSchema.parse(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('open_shifts').delete().eq('id', id);
    if (error) throw error;
  },
};
