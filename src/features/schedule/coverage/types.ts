import { z } from 'zod';

/** Minimum headcount required at a location on a given weekday (0=Sun..6). */
export const CoverageRequirementSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  location_id: z.string(),
  day_of_week: z.number().int().min(0).max(6),
  min_headcount: z.number().int().min(0),
  created_at: z.string(),
});

export type CoverageRequirement = z.infer<typeof CoverageRequirementSchema>;

export interface CoverageRequirementInput {
  location_id: string;
  day_of_week: number;
  min_headcount: number;
}
