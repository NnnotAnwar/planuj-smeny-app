import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@shared/api/supabaseClient';
import { z } from 'zod';
import { type User } from '@shared/types';

/**
 * --- useAnnouncementReads ---
 * Read-receipts for announcements. For a member: which announcements they've
 * read (`readIds`) + `markRead(id)`. A thin self-contained slice (its own tiny
 * service inline) that complements useAnnouncements.
 */
const ReadSchema = z.object({ announcement_id: z.string(), read_at: z.string() });

export function useAnnouncementReads(user: User | null) {
  const qc = useQueryClient();
  const enabled = !!user;
  const key = ['announcement-reads', user?.id ?? 'anon'];

  const reads = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcement_reads')
        .select('announcement_id, read_at')
        .eq('user_id', user!.id);
      if (error) throw error;
      return z.array(ReadSchema).parse(data ?? []);
    },
    enabled,
  });

  const readIds = useMemo(() => new Set((reads.data ?? []).map((r) => r.announcement_id)), [reads.data]);

  const markRead = useMutation({
    mutationFn: async (announcementId: string) => {
      if (!user) throw new Error('You must be signed in.');
      const { error } = await supabase
        .from('announcement_reads')
        .upsert(
          { announcement_id: announcementId, user_id: user.id, organization_id: user.organization_id },
          { onConflict: 'announcement_id,user_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { reads, readIds, markRead };
}
