import { useQuery } from '@tanstack/react-query';
import { useAuthContext } from '@/features/auth/AuthContext';
import { isSuperAdmin } from '@shared/auth/permissions';
import { announcementService } from './announcementService';
import { announcementKeys } from './announcementKeys';
import { useAnnouncementReads } from './reads/useAnnouncementReads';

/**
 * Announcements the current user hasn't opened yet (their own posts don't
 * count) — the badge on the Announcements tab. Reads the same cached list as
 * useAnnouncements (same key + fetcher) but WITHOUT its realtime channel: the
 * nav mounts this several times at once, and the banner/page already keep
 * the cache live.
 */
export function useUnreadAnnouncementCount(): number {
    const { user } = useAuthContext();
    const orgId = user?.organization_id ?? 'anon';
    const { data } = useQuery({
        queryKey: announcementKeys.list(orgId),
        queryFn: () => announcementService.getAnnouncements(user!.organization_id, !!user && isSuperAdmin(user)),
        enabled: !!user,
    });
    const { readIds } = useAnnouncementReads(user);
    return (data ?? []).filter((a) => a.author_id !== user?.id && !readIds.has(a.id)).length;
}
