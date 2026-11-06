import { supabase } from '@shared/api/supabaseClient';
import { z } from 'zod';
import { type User } from '@shared/types';
import { CoverageRequirementSchema, type CoverageRequirement, type CoverageRequirementInput } from './types';

/** Data access for per-location/weekday minimum headcount rules. */
export const coverageService = {
  async getForOrg(organizationId: string): Promise<CoverageRequirement[]> {
    const { data, error } = await supabase
      .from('coverage_requirements')
      .select('*')
      .eq('organization_id', organizationId);
    if (error) throw error;
    return z.array(CoverageRequirementSchema).parse(data ?? []);
  },

  /** Upsert the rule for a (location, weekday) slot. */
  async set(user: User, input: CoverageRequirementInput): Promise<CoverageRequirement> {
    const { data, error } = await supabase
      .from('coverage_requirements')
      .upsert(
        {
          organization_id: user.organization_id,
          location_id: input.location_id,
          day_of_week: input.day_of_week,
          min_headcount: input.min_headcount,
        },
        { onConflict: 'location_id,day_of_week' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return CoverageRequirementSchema.parse(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('coverage_requirements').delete().eq('id', id);
    if (error) throw error;
  },
};
