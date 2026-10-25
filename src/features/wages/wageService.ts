import { supabase } from '@shared/api/supabaseClient';
import { z } from 'zod';
import { type User } from '@shared/types';
import { MemberWageSchema, type MemberWage, type MemberWageInput } from './types';

/** Data access for member hourly rates. RLS keeps peers' pay private. */
export const wageService = {
  /** The caller's own rate (members), or null if none set. */
  async getMine(userId: string): Promise<MemberWage | null> {
    const { data, error } = await supabase
      .from('member_wages')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ? MemberWageSchema.parse(data) : null;
  },

  /** All rates in an org (managers only, enforced by RLS). */
  async getForOrg(organizationId: string): Promise<MemberWage[]> {
    const { data, error } = await supabase
      .from('member_wages')
      .select('*')
      .eq('organization_id', organizationId);
    if (error) throw error;
    return z.array(MemberWageSchema).parse(data ?? []);
  },

  /** Manager sets/updates a member's rate (one current rate per member). */
  async setRate(manager: User, input: MemberWageInput): Promise<MemberWage> {
    const { data, error } = await supabase
      .from('member_wages')
      .upsert(
        {
          organization_id: manager.organization_id,
          user_id: input.user_id,
          hourly_rate: input.hourly_rate,
          currency: input.currency ?? 'CZK',
          effective_from: input.effective_from ?? new Date().toISOString().slice(0, 10),
          created_by: manager.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return MemberWageSchema.parse(data);
  },
};
