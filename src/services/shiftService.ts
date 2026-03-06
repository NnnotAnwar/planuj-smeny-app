import { supabase } from '../../supabaseClient';
import { type Shift, type User } from '../types/types';
import { ShiftSchema } from '../types/schemas';
import { z } from 'zod';

/**
 * Service for managing shift operations (CRUD).
 */
export const shiftService = {
  /**
   * Fetches the currently active shift for a specific user.
   * @param userId - ID of the user.
   * @returns The active shift object or null if none is running.
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
   * Retrieves all active shifts within an organization.
   * @param organizationId - ID of the organization.
   * @returns Array of active shifts including profile details.
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
   * Starts a new shift for a user.
   * @param user - User object containing profile details.
   * @param locationId - ID of the location where the shift is starting.
   * @returns The newly created shift record.
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
   * Marks a shift as ended.
   * @param shiftId - ID of the shift to terminate.
   * @returns The updated shift record.
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
  }
};
