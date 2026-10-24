import { z } from 'zod';

/** An unassigned shift a manager posts for members to claim. */
export const OpenShiftSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  location_id: z.string(),
  role: z.string().nullable().optional(),
  starts_at: z.string(),
  ends_at: z.string(),
  note: z.string().nullable().optional(),
  created_by: z.string().nullable().optional(),
  claimed_by: z.string().nullable().optional(),
  claimed_at: z.string().nullable().optional(),
  created_at: z.string(),
  // Joined claimer profile for the manager's view.
  claimer: z
    .object({
      username: z.string(),
      first_name: z.string().nullable(),
      last_name: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export type OpenShift = z.infer<typeof OpenShiftSchema>;

export interface OpenShiftInput {
  location_id: string;
  starts_at: string;
  ends_at: string;
  role?: string | null;
  note?: string | null;
}
