import { supabase } from '@shared/api/supabaseClient';
import { z } from 'zod';
import { type User } from '@shared/types';
import { AnnouncementSchema, type Announcement, type AnnouncementInput } from './types';

/**
 * --- ANNOUNCEMENT SERVICE ---
 * The only place that talks to the `announcements` table. Components never call
 * Supabase directly — they go through the hook (useAnnouncements) which calls
 * these functions. RLS on the table is the real guard; these just shape the
 * queries and validate the results (see locationService for the same pattern).
 */

// Pull the author's name alongside each row for the "posted by" line. Only
// author_id references profiles, so this embed is unambiguous.
const SELECT_WITH_AUTHOR =
  '*, author:profiles(username, first_name, last_name)';

export const announcementService = {
  /** All announcements the current user may see, newest first, pinned on top. */
  async getAnnouncements(organizationId: string, isSuperAdmin = false): Promise<Announcement[]> {
    let query = supabase
      .from('announcements')
      .select(SELECT_WITH_AUTHOR)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    // Superadmin sees every org; everyone else is scoped by RLS anyway, but we
    // filter client-side too so the query is cheap and explicit.
    if (!isSuperAdmin) {
      query = query.eq('organization_id', organizationId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return z.array(AnnouncementSchema).parse(data ?? []);
  },

  /** Post a new announcement as the current user (must be a manager, enforced by RLS). */
  async createAnnouncement(user: User, input: AnnouncementInput): Promise<Announcement> {
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        organization_id: user.organization_id,
        author_id: user.id,
        title: input.title.trim(),
        body: input.body.trim(),
        location_id: input.location_id ?? null,
        pinned: input.pinned ?? false,
      })
      .select(SELECT_WITH_AUTHOR)
      .single();

    if (error) throw error;
    return AnnouncementSchema.parse(data);
  },

  /** Edit an existing announcement (manager only, enforced by RLS). */
  async updateAnnouncement(id: string, patch: Partial<AnnouncementInput>): Promise<Announcement> {
    const next: Record<string, unknown> = {};
    if (patch.title !== undefined) next.title = patch.title.trim();
    if (patch.body !== undefined) next.body = patch.body.trim();
    if (patch.location_id !== undefined) next.location_id = patch.location_id;
    if (patch.pinned !== undefined) next.pinned = patch.pinned;

    const { data, error } = await supabase
      .from('announcements')
      .update(next)
      .eq('id', id)
      .select(SELECT_WITH_AUTHOR)
      .single();

    if (error) throw error;
    return AnnouncementSchema.parse(data);
  },

  /** Remove an announcement (manager only, enforced by RLS). */
  async deleteAnnouncement(id: string): Promise<void> {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw error;
  },
};
