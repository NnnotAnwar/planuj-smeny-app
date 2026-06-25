import { supabase } from '@shared/api/supabaseClient';
import { ShiftAuditLogSchema, type ShiftAuditLog } from '@shared/types';
import { z } from 'zod';

/**
 * --- NOTIFICATIONS SERVICE ---
 * A user's notifications are simply the audit-log entries that target them:
 * shift add/edit/delete on their schedule, username changes, and name-change
 * request decisions. RLS scopes the rows to `target_user_id = auth.uid()`.
 */
export const notificationsService = {
    async getMyNotifications(userId: string, limit = 30): Promise<ShiftAuditLog[]> {
        const { data, error } = await supabase
            .from('shift_audit_log')
            .select('*')
            .eq('target_user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return z.array(ShiftAuditLogSchema).parse(data ?? []);
    },
};
