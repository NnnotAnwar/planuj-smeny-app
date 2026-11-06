import { supabase } from '@shared/api/supabaseClient';
import { z } from 'zod';
import { type User } from '@shared/types';
import { ShiftConfirmationSchema, type ShiftConfirmation } from './types';

/**
 * --- SHIFT CONFIRMATION SERVICE ---
 * The only place that talks to `shift_confirmations`. RLS guarantees a member
 * can only confirm their OWN published shifts and read their own rows (managers
 * read the whole org). Components go through useShiftConfirmations, not here.
 */
export const shiftConfirmationService = {
  /** The scheduled shifts the current member has confirmed. */
  async getMine(userId: string): Promise<ShiftConfirmation[]> {
    const { data, error } = await supabase
      .from('shift_confirmations')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return z.array(ShiftConfirmationSchema).parse(data ?? []);
  },

  /** Every confirmation in an org (manager view: who has acknowledged). */
  async getForOrg(organizationId: string): Promise<ShiftConfirmation[]> {
    const { data, error } = await supabase
      .from('shift_confirmations')
      .select('*')
      .eq('organization_id', organizationId);
    if (error) throw error;
    return z.array(ShiftConfirmationSchema).parse(data ?? []);
  },

  /** Acknowledge a published shift assigned to the current member. */
  async confirm(user: User, scheduledShiftId: string): Promise<ShiftConfirmation> {
    const { data, error } = await supabase
      .from('shift_confirmations')
      .upsert(
        {
          scheduled_shift_id: scheduledShiftId,
          user_id: user.id,
          organization_id: user.organization_id,
        },
        { onConflict: 'scheduled_shift_id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return ShiftConfirmationSchema.parse(data);
  },

  /**
   * Acknowledge several published shifts in one request ("Confirm all").
   * ON CONFLICT DO NOTHING, so an already-confirmed id is simply skipped —
   * there's no UPDATE policy to fall back on, and none is needed.
   */
  async confirmMany(user: User, scheduledShiftIds: string[]): Promise<void> {
    if (scheduledShiftIds.length === 0) return;
    const { error } = await supabase.from('shift_confirmations').upsert(
      scheduledShiftIds.map((id) => ({
        scheduled_shift_id: id,
        user_id: user.id,
        organization_id: user.organization_id,
      })),
      { onConflict: 'scheduled_shift_id', ignoreDuplicates: true },
    );
    if (error) throw error;
  },

  /** Withdraw a confirmation. */
  async unconfirm(scheduledShiftId: string): Promise<void> {
    const { error } = await supabase
      .from('shift_confirmations')
      .delete()
      .eq('scheduled_shift_id', scheduledShiftId);
    if (error) throw error;
  },
};
