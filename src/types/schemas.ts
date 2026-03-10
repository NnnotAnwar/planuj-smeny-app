import { z } from 'zod';

export const ProfileSchema = z.object({
  id: z.string(),
  username: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  role: z.string(),
  organization_id: z.string(),
});

export const ShiftSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  location_id: z.string(),
  organization_id: z.string(),
  started_at: z.string(),
  ended_at: z.string().nullable(),
  role: z.string(),
  profiles: z.object({
    username: z.string(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable()
  }).optional().nullable()
});

export const LocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  organization_id: z.string().optional(),
});

export type ProfileSchemaType = z.infer<typeof ProfileSchema>;
export type ShiftSchemaType = z.infer<typeof ShiftSchema>;
export type LocationSchemaType = z.infer<typeof LocationSchema>;
