import { z } from 'zod';
import { supabase } from '@shared/api/supabaseClient';
import { NameChangeRequestSchema, type NameChangeRequest, type TimeOff } from '@shared/types';
import { scheduleService } from '@features/schedule/scheduleService';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * --- REQUESTS SERVICE ---
 * Reads for the shared Requests inbox. RLS scopes every query: members get
 * their own rows, managers (observers) and admins get the organization's.
 */
export const requestsService = {
    /** Leave overlapping three months back … a year ahead, any status. */
    async getTimeOff(): Promise<TimeOff[]> {
        const now = new Date();
        const from = isoDay(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()));
        const to = isoDay(new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()));
        return scheduleService.getTimeOff(from, to);
    },

    /** Name-change requests: every pending one + anything from the last 90 days. */
    async getNameRequests(): Promise<NameChangeRequest[]> {
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from('name_change_requests')
            .select(
                'id, user_id, organization_id, current_first_name, current_last_name, requested_first_name, requested_last_name, note, review_note, status, reviewed_at, created_at, requester:profiles!name_change_requests_user_id_fkey(username, email, first_name, last_name)',
            )
            .or(`status.eq.pending,created_at.gte.${since}`)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return z.array(NameChangeRequestSchema).parse(data ?? []);
    },
};
