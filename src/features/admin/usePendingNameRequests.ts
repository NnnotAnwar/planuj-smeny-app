import { useQuery } from '@tanstack/react-query';
import { adminService } from './adminService';
import { useAuthContext } from '@/features/auth/AuthContext';

/**
 * Pending name-change request count for the current admin (rank >= 30).
 * Reuses the exact query key AdminContext uses, so the nav badge and the
 * Requests page share a single cached fetch. Returns 0 for non-admins.
 */
export function usePendingNameRequestCount(): number {
    const { user } = useAuthContext();
    const canReview = (user?.role.rank ?? 0) >= 30;

    const { data } = useQuery({
        queryKey: ['admin', 'name-requests', user?.id],
        queryFn: () => adminService.getNameChangeRequests(),
        enabled: !!user && canReview,
    });

    return data?.length ?? 0;
}
