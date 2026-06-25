import { supabase } from '@shared/api/supabaseClient';
import { type Shift, type ShiftWithProfile, type User, ShiftSchema, ShiftWithProfileSchema } from '@shared/types';
import { z } from 'zod';

/**
 * --- SHIFT SERVICE ---
 * Handles all database operations related to worker shifts (Start, End, Fetch).
 */

// A bare shift row (own active shift / history) vs. a board row that joins the
// worker profile so colleague cards can render a name.
const SHIFT_SELECT = '*';
const SHIFT_WITH_PROFILE_SELECT = '*, profiles(username, first_name, last_name, role)';

// Raw row for the profile "currently working" lookup. `shifts` has TWO FKs to
// `locations` (location_id + previous_location_id), so the embed MUST name the
// constraint or PostgREST errors on the ambiguity (which silently rendered
// everyone as "off shift").
const STATUS_SELECT = 'started_at, location_id, location:locations!shifts_location_id_fkey(name)';
const ActiveShiftStatusRowSchema = z.object({
  started_at: z.string(),
  location_id: z.string(),
  location: z.object({ name: z.string() }).nullable(),
});

/** Where and since when a user is currently clocked in, or null when off shift. */
export interface ActiveShiftStatus {
  started_at: string;
  location_id: string;
  location_name: string | null;
}

export const shiftService = {
  /**
   * Fetches the currently running shift for a specific user.
   */
  async getActiveShift(userId: string): Promise<Shift | null> {
    const { data, error } = await supabase
      .from('shifts')
      .select(SHIFT_SELECT)
      .eq('user_id', userId)
      .is('ended_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return ShiftSchema.parse(data);
  },

  /**
   * Lightweight "are they working right now?" lookup for the profile page:
   * the user's open shift with its location name joined, or null when off shift.
   */
  async getActiveShiftStatus(userId: string): Promise<ActiveShiftStatus | null> {
    const { data, error } = await supabase
      .from('shifts')
      .select(STATUS_SELECT)
      .eq('user_id', userId)
      .is('ended_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const parsed = ActiveShiftStatusRowSchema.parse(data);
    return {
      started_at: parsed.started_at,
      location_id: parsed.location_id,
      location_name: parsed.location?.name ?? null,
    };
  },

  /**
   * Retrieves all active shifts in the whole organization.
   * Useful to see who else is working right now.
   */
  async getAllActiveShifts(organizationId: string, isSuperAdmin: boolean): Promise<ShiftWithProfile[]> {

    let query = supabase
      .from('shifts')
      .select(SHIFT_WITH_PROFILE_SELECT)
      .is('ended_at', null);

    if (!isSuperAdmin) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query

    if (error) throw error;
    if (!data) return [];

    return z.array(ShiftWithProfileSchema).parse(data);
  },

  /**
   * Fetches all shifts (past and present) for a specific user.
   */
  async getAllUserShifts(userId: string): Promise<Shift[]> {
    const { data, error } = await supabase
      .from('shifts')
      .select(SHIFT_SELECT)
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
        role: user.role.name
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
