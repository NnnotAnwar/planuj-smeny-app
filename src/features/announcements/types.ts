import { z } from 'zod';

/**
 * --- ANNOUNCEMENT TYPES ---
 * An announcement is a short notice a manager posts to the whole organization
 * (location_id = null) or to a single location. We validate rows coming back
 * from Supabase with Zod, same as the rest of the app (see shared/types).
 */
export const AnnouncementSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  location_id: z.string().nullable().optional(), // null = whole organization
  author_id: z.string().nullable().optional(), // null if the author left
  title: z.string(),
  body: z.string(),
  pinned: z.boolean().default(false),
  created_at: z.string(),
  updated_at: z.string(),
  // Author profile, joined in the list query for the "posted by" line.
  author: z
    .object({
      username: z.string(),
      first_name: z.string().nullable(),
      last_name: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export type Announcement = z.infer<typeof AnnouncementSchema>;

/** Fields a manager fills in when posting / editing. */
export interface AnnouncementInput {
  title: string;
  body: string;
  location_id?: string | null; // omit / null = whole org
  pinned?: boolean;
}
