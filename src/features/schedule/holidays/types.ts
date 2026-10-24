import { z } from 'zod';

/**
 * --- PUBLIC HOLIDAY TYPES ---
 * National reference data — one row per public-holiday date, with the name in
 * Czech and English so the rota can label it in the user's language.
 */
export const PublicHolidaySchema = z.object({
  holiday_date: z.string(), // YYYY-MM-DD
  name_cs: z.string(),
  name_en: z.string(),
  country: z.string().default('CZ'),
});

export type PublicHoliday = z.infer<typeof PublicHolidaySchema>;
