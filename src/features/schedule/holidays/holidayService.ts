import { supabase } from '@shared/api/supabaseClient';
import { z } from 'zod';
import { PublicHolidaySchema, type PublicHoliday } from './types';

/**
 * --- HOLIDAY SERVICE ---
 * Reads the national public-holiday reference table. Optionally bounded to a
 * date range (e.g. the month the rota grid is showing) to keep the payload tiny.
 */
export const holidayService = {
  async getHolidays(fromDate?: string, toDate?: string): Promise<PublicHoliday[]> {
    let query = supabase
      .from('public_holidays')
      .select('*')
      .order('holiday_date', { ascending: true });

    if (fromDate) query = query.gte('holiday_date', fromDate);
    if (toDate) query = query.lte('holiday_date', toDate);

    const { data, error } = await query;
    if (error) throw error;
    return z.array(PublicHolidaySchema).parse(data ?? []);
  },
};
