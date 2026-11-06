import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { holidayService } from './holidayService';
import { type PublicHoliday } from './types';

/**
 * --- useHolidays ---
 * Public holidays for an optional date range, plus a ready-made lookup map so a
 * rota cell can ask `holidaysByDate.get('2026-12-24')` in O(1). Reference data
 * rarely changes, so it's cached for a day.
 */
export function useHolidays(fromDate?: string, toDate?: string) {
  const query = useQuery({
    queryKey: ['public-holidays', fromDate ?? 'all', toDate ?? 'all'],
    queryFn: () => holidayService.getHolidays(fromDate, toDate),
    staleTime: 24 * 60 * 60 * 1000, // 1 day — holidays don't move
  });

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, PublicHoliday>();
    for (const h of query.data ?? []) map.set(h.holiday_date, h);
    return map;
  }, [query.data]);

  /** Localized holiday name for a date, or null if it's an ordinary day. */
  const holidayName = (dateStr: string, lang: 'en' | 'cs'): string | null => {
    const h = holidaysByDate.get(dateStr);
    if (!h) return null;
    return lang === 'cs' ? h.name_cs : h.name_en;
  };

  return { query, holidaysByDate, holidayName };
}
