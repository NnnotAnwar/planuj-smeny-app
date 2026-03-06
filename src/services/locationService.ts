import { supabase } from '../../supabaseClient';
import { type Location } from '../types/types';
import { LocationSchema } from '../types/schemas';
import { z } from 'zod';

/**
 * Service for location-related data fetching.
 */
export const locationService = {
  /**
   * Fetches all locations belonging to a specific organization.
   * @param organizationId - ID of the organization.
   * @returns Formatted location objects.
   */
  async getLocations(organizationId: string): Promise<Location[]> {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('organization_id', organizationId);
    
    if (error) throw error;
    if (!data) return [];

    const validated = z.array(LocationSchema).parse(data);
    return validated.map(l => ({ id: l.id, name: l.name, shifts: [] }));
  }
};
