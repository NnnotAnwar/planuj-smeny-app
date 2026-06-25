import { useQuery } from '@tanstack/react-query';
import { shiftService } from '../shiftService';
import { locationService } from '@features/locations/locationService';
import { isSuperAdmin } from '@shared/auth/permissions';
import { type User } from '@shared/types';
import { shiftKeys } from '../shiftKeys';

/**
 * --- useShiftQueries ---
 * The four pieces of server state the shift feature reads: the user's own
 * active shift, the live board (everyone working now), the user's full history,
 * and the locations they can clock in at. React Query gives us caching, dedupe,
 * retries and background refresh — replacing the hand-rolled Promise.all +
 * refreshData + hasLoadedOnce plumbing the old useShifts hook carried.
 */
export function useShiftQueries(user: User | null) {
    const enabled = !!user;
    const sa = enabled && isSuperAdmin(user);

    const activeShift = useQuery({
        queryKey: shiftKeys.active(user?.id ?? 'anon'),
        queryFn: () => shiftService.getActiveShift(user!.id),
        enabled,
    });

    const board = useQuery({
        queryKey: shiftKeys.board(user?.organization_id ?? 'anon'),
        queryFn: () => shiftService.getAllActiveShifts(user!.organization_id, sa),
        enabled,
    });

    const history = useQuery({
        queryKey: shiftKeys.history(user?.id ?? 'anon'),
        queryFn: () => shiftService.getAllUserShifts(user!.id),
        enabled,
    });

    const locations = useQuery({
        queryKey: shiftKeys.locations(user?.organization_id ?? 'anon'),
        queryFn: () => locationService.getLocations(user!.organization_id, sa),
        enabled,
    });

    return { activeShift, board, history, locations };
}
