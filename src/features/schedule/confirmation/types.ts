import { z } from 'zod';

/**
 * --- SHIFT CONFIRMATION TYPES ---
 * A member acknowledging ("Got it") a published rota shift. One row per
 * scheduled shift (its assigned member), so `scheduled_shift_id` is unique.
 */
export const ShiftConfirmationSchema = z.object({
  scheduled_shift_id: z.string(),
  user_id: z.string(),
  organization_id: z.string(),
  confirmed_at: z.string(),
});

export type ShiftConfirmation = z.infer<typeof ShiftConfirmationSchema>;
