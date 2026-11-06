import { z } from 'zod';

/** A reusable rota building block ("Morning 7–15"). */
export const ShiftTemplateSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  name: z.string(),
  role: z.string().nullable().optional(),
  start_time: z.string(), // HH:MM[:SS]
  end_time: z.string(),
  color: z.string().nullable().optional(),
  created_by: z.string().nullable().optional(),
  created_at: z.string(),
});

export type ShiftTemplate = z.infer<typeof ShiftTemplateSchema>;

export interface ShiftTemplateInput {
  name: string;
  start_time: string;
  end_time: string;
  role?: string | null;
  color?: string | null;
}
