import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@shared/api/supabaseClient';
import { isSuperAdmin } from '@shared/auth/permissions';
import { toast } from '@shared/toast/toastStore';
import { type User } from '@shared/types';
import { announcementService } from './announcementService';
import { announcementKeys } from './announcementKeys';
import { type AnnouncementInput } from './types';

/**
 * --- useAnnouncements ---
 * All the server state the Announcements feature needs, as one hook:
 *   • `list`   — the org's announcements (React Query: cache / dedupe / refetch)
 *   • `create` / `update` / `remove` — manager mutations that refresh the list
 * Plus a realtime subscription so a notice posted on one device appears on the
 * others without a manual refresh (same idea as useShiftRealtime, simplified).
 *
 * UI components call THIS hook — never the service or supabase directly.
 */
export function useAnnouncements(user: User | null) {
  const qc = useQueryClient();
  const enabled = !!user;
  const sa = enabled && isSuperAdmin(user);
  const orgId = user?.organization_id ?? 'anon';
  const listKey = announcementKeys.list(orgId);

  const list = useQuery({
    queryKey: listKey,
    queryFn: () => announcementService.getAnnouncements(user!.organization_id, sa),
    enabled,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: listKey });

  const create = useMutation({
    mutationFn: (input: AnnouncementInput) => {
      if (!user) throw new Error('You must be signed in to post an announcement.');
      return announcementService.createAnnouncement(user, input);
    },
    onSuccess: () => {
      refresh();
      toast('Announcement posted.', 'success');
    },
    onError: (e: unknown) => toast(e instanceof Error ? e.message : 'Could not post the announcement.', 'error'),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<AnnouncementInput> }) =>
      announcementService.updateAnnouncement(id, patch),
    onSuccess: () => {
      refresh();
      toast('Announcement updated.', 'success');
    },
    onError: (e: unknown) => toast(e instanceof Error ? e.message : 'Could not update the announcement.', 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => announcementService.deleteAnnouncement(id),
    onSuccess: () => {
      refresh();
      toast('Announcement removed.', 'success');
    },
    onError: (e: unknown) => toast(e instanceof Error ? e.message : 'Could not remove the announcement.', 'error'),
  });

  // Live updates: any insert/update/delete in this org refreshes the list.
  useEffect(() => {
    if (!user?.organization_id) return;
    const channel = supabase
      .channel(`announcements:${user.organization_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcements',
          ...(sa ? {} : { filter: `organization_id=eq.${user.organization_id}` }),
        },
        () => qc.invalidateQueries({ queryKey: listKey }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // listKey is derived from orgId; re-subscribe only when the org changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.organization_id, sa]);

  return { list, create, update, remove };
}
