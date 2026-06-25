import { useQuery } from '@tanstack/react-query';
import { shiftService } from '@features/shifts/shiftService';

/**
 * --- useUserStatus ---
 * Live "are they working right now?" lookup for a profile (own or an employee's).
 * Returns the open shift + its location, or null when off shift. Kept short so
 * the badge reflects clock-in/out reasonably fresh.
 */
export function useUserStatus(userId: string | undefined) {
    return useQuery({
        queryKey: ['shift-status', userId],
        queryFn: () => shiftService.getActiveShiftStatus(userId!),
        enabled: !!userId,
        staleTime: 30_000,
    });
}
