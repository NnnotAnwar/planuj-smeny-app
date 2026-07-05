import { useQuery } from '@tanstack/react-query';
import { scheduleService } from './scheduleService';

/**
 * --- useTodayPlannedLocation ---
 * Where the user is rostered TODAY, for preselecting the clock-in location:
 * prefer the planned shift covering right now (or an all-day assignment),
 * otherwise the next upcoming one today. Null when nothing is planned.
 */
export function useTodayPlannedLocation(userId?: string): string | null {
    const q = useQuery({
        queryKey: ['planned-today', userId],
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            const all = await scheduleService.getRange(start.toISOString(), end.toISOString());
            const mine = all
                .filter((s) => s.user_id === userId && s.location_id)
                .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
            if (mine.length === 0) return null;
            const now = Date.now();
            const current = mine.find(
                (s) => new Date(s.starts_at).getTime() <= now && now < new Date(s.ends_at).getTime(),
            );
            if (current) return current.location_id;
            const upcoming = mine.find((s) => new Date(s.starts_at).getTime() > now);
            return (upcoming ?? mine[mine.length - 1]).location_id;
        },
    });
    return q.data ?? null;
}
