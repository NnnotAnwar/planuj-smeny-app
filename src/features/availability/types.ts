import { z } from 'zod';

/**
 * --- AVAILABILITY TYPES ---
 * A member's "I can't / prefer not to work" entry. Either recurring
 * (`day_of_week` 0=Sun..6) or a one-off (`specific_date`) — exactly one is set.
 * `all_day` false means the window is time-bounded (start_time..end_time).
 * Advisory input for rota planning (unlike approved time_off, which is a lock).
 */
export const AvailabilitySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  organization_id: z.string(),
  kind: z.enum(['unavailable', 'preferred']).default('unavailable'),
  day_of_week: z.number().int().min(0).max(6).nullable().optional(),
  specific_date: z.string().nullable().optional(), // YYYY-MM-DD
  all_day: z.boolean().default(true),
  start_time: z.string().nullable().optional(), // HH:MM[:SS]
  end_time: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  created_at: z.string(),
  // Joined member profile for the manager's planning view.
  profiles: z
    .object({
      username: z.string(),
      first_name: z.string().nullable(),
      last_name: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export type Availability = z.infer<typeof AvailabilitySchema>;

/** Fields a member fills in. Provide exactly one of day_of_week / specific_date. */
export interface AvailabilityInput {
  kind?: 'unavailable' | 'preferred';
  day_of_week?: number | null;
  specific_date?: string | null;
  all_day?: boolean;
  start_time?: string | null;
  end_time?: string | null;
  note?: string | null;
}
