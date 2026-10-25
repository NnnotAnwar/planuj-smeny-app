import { z } from 'zod';

/** Operational settings for one location (open hours, break rule, timezone). */
export const LocationSettingsSchema = z.object({
  location_id: z.string(),
  organization_id: z.string(),
  open_time: z.string().nullable().optional(), // HH:MM[:SS]
  close_time: z.string().nullable().optional(),
  timezone: z.string().default('Europe/Prague'),
  break_minutes: z.number().int().min(0).default(0),
  updated_at: z.string(),
});

export type LocationSettings = z.infer<typeof LocationSettingsSchema>;

export interface LocationSettingsInput {
  location_id: string;
  open_time?: string | null;
  close_time?: string | null;
  timezone?: string;
  break_minutes?: number;
}
