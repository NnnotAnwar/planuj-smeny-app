import { supabase } from '@shared/api/supabaseClient';
import { z } from 'zod';
import { type User } from '@shared/types';
import { LocationSettingsSchema, type LocationSettings, type LocationSettingsInput } from './types';

/** Data access for per-location operational settings. */
export const locationSettingsService = {
  async getForOrg(organizationId: string): Promise<LocationSettings[]> {
    const { data, error } = await supabase
      .from('location_settings')
      .select('*')
      .eq('organization_id', organizationId);
    if (error) throw error;
    return z.array(LocationSettingsSchema).parse(data ?? []);
  },

  /** Upsert the settings for one location (manager only, enforced by RLS). */
  async save(manager: User, input: LocationSettingsInput): Promise<LocationSettings> {
    const { data, error } = await supabase
      .from('location_settings')
      .upsert(
        {
          location_id: input.location_id,
          organization_id: manager.organization_id,
          open_time: input.open_time ?? null,
          close_time: input.close_time ?? null,
          timezone: input.timezone ?? 'Europe/Prague',
          break_minutes: input.break_minutes ?? 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'location_id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return LocationSettingsSchema.parse(data);
  },
};
