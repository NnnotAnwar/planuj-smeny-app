import { supabase } from '@shared/api/supabaseClient';
import { type Shift, type User } from '@shared/types';
import { ShiftSchema } from '@shared/types';
import { z } from 'zod';

/**
 * --- SHIFT SERVICE ---
 * Handles all database operations related to worker shifts (Start, End, Fetch).
 */

export const shiftService = {
  /**
   * Fetches the currently running shift for a specific user.
   */
  async getActiveShift(userId: string): Promise<Shift | null> {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', userId)
      .is('ended_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return ShiftSchema.parse(data);
  },

  /**
   * Retrieves all active shifts in the whole organization.
   * Useful to see who else is working right now.
   */
  async getAllActiveShifts(organizationId: string): Promise<Shift[]> {
    const { data, error } = await supabase
      .from('shifts')
      .select('*, profiles(username, first_name, last_name)')
      .eq('organization_id', organizationId)
      .is('ended_at', null);

    if (error) throw error;
    if (!data) return [];

    return z.array(ShiftSchema).parse(data);
  },

  /**
   * Fetches all shifts (past and present) for a specific user.
   */
  async getAllUserShifts(userId: string): Promise<Shift[]> {
    const { data, error } = await supabase
      .from('shifts')
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;
    if (!data) return [];

    return z.array(ShiftSchema).parse(data);
  },

  /**
   * Starts a new shift.
   */
  async startShift(user: User, locationId: string): Promise<Shift> {
    const { data, error } = await supabase
      .from('shifts')
      .insert({
        user_id: user.id,
        location_id: locationId,
        organization_id: user.organization_id,
        started_at: new Date().toISOString(),
        role: user.role
      })
      .select()
      .single();

    if (error) throw error;
    return ShiftSchema.parse(data);
  },

  /**
   * Ends a shift by setting the 'ended_at' timestamp.
   */
  async endShift(shiftId: string): Promise<Shift> {
    const { data, error } = await supabase
      .from('shifts')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', shiftId)
      .select()
      .single();

    if (error) throw error;
    return ShiftSchema.parse(data);
  },

  /**
   * Updates the location of an existing active shift.
   * @param shiftId - ID of the shift to update.
   * @param locationId - The new location ID.
   * @param previousLocationId - The location they just came from.
   */
  async changeShiftLocation(shiftId: string, locationId: string, previousLocationId: string | null): Promise<Shift> {
    const { data, error } = await supabase
      .from('shifts')
      .update({ 
        location_id: locationId,
        previous_location_id: previousLocationId 
      })
      .eq('id', shiftId)
      .select()
      .single();

    if (error) throw error;
    return ShiftSchema.parse(data);
  }
};
