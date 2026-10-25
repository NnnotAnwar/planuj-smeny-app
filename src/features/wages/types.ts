import { z } from 'zod';

/** A member's hourly pay rate (sensitive — RLS: own, or manager in org). */
export const MemberWageSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  user_id: z.string(),
  hourly_rate: z.coerce.number(), // numeric comes back as a string from supabase-js
  currency: z.string().default('CZK'),
  effective_from: z.string(),
  created_by: z.string().nullable().optional(),
  updated_at: z.string(),
});

export type MemberWage = z.infer<typeof MemberWageSchema>;

export interface MemberWageInput {
  user_id: string;
  hourly_rate: number;
  currency?: string;
  effective_from?: string;
}

/** Estimated pay for a number of worked hours at a rate. */
export function estimatePay(hours: number, rate: number): number {
  return Math.round(hours * rate * 100) / 100;
}
