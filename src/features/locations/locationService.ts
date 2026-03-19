import { supabase } from '@shared/api/supabaseClient';
import { type Location } from '@shared/types';
import { LocationSchema } from '@shared/types';
import { z } from 'zod';

/**
 * --- LOCATION SERVICE ---
 * Handles fetching list of available locations (restaurants, shops, etc.)
 */

export const locationService = {
  /**
   * Fetches all locations for a given organization.
   */
  async getLocations(organizationId: string): Promise<Location[]> {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('organization_id', organizationId);
    
    if (error) throw error;
    if (!data) return [];

    // Validate that the array of locations matches our expected structure.
    const validated = z.array(LocationSchema).parse(data);
    
    // Return them in a format the app likes.
    return validated.map(l => ({ 
      id: l.id, 
      name: l.name, 
      organization_id: l.organization_id 
    }));
  }
};
