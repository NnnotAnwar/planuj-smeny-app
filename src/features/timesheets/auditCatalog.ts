import type { TranslationKey } from '@shared/i18n/translations';

/**
 * --- ACTIVITY LOG CATALOG ---
 * Every action the activity log knows, grouped for the filter. The DB writes
 * them (triggers + RPCs + Edge Functions); keep this list in step when adding
 * a new one — `auditCatalog.test.ts` checks every action has a group + label.
 */
export const AUDIT_GROUPS = {
    shifts: ['create', 'update', 'delete', 'clock_in', 'clock_out', 'clock_switched', 'late_15', 'late_60'],
    schedule: [
        'schedule_created', 'schedule_updated', 'schedule_removed', 'schedule_published', 'shift_confirmed',
        'open_shift_posted', 'open_shift_edited', 'open_shift_claimed', 'open_shift_released', 'open_shift_removed',
        'template_created', 'template_updated', 'template_deleted', 'coverage_updated',
        'availability_updated', 'availability_removed',
    ],
    requests: [
        'timeoff_requested', 'timeoff_approved', 'timeoff_declined', 'timeoff_cancelled',
        'swap_offered', 'swap_taken', 'swap_requested', 'swap_approved', 'swap_declined', 'swap_withdrawn', 'swap_released',
        'name_requested', 'name_request_approved', 'name_request_rejected', 'name_request_cancelled',
    ],
    team: [
        'member_invited', 'member_removed', 'member_left', 'profile_updated', 'username_change',
        'wage_changed', 'wage_removed', 'roster_added', 'roster_removed',
    ],
    roles: ['role_created', 'role_updated', 'role_moved', 'role_deleted', 'role_permissions'],
    announcements: ['announcement_posted', 'announcement_edited', 'announcement_deleted'],
    places: ['location_created', 'location_updated', 'location_archived', 'location_restored', 'location_hours', 'org_created', 'org_updated'],
} as const;

export type AuditGroup = keyof typeof AUDIT_GROUPS;
export const AUDIT_GROUP_KEYS = Object.keys(AUDIT_GROUPS) as AuditGroup[];

export const groupLabel = (g: AuditGroup): TranslationKey => `audit.group.${g}` as TranslationKey;

/**
 * One event can fan out into a row per recipient (e.g. a time-off request
 * notifies every reviewer). The log shows it once.
 */
const FANOUT = new Set(['timeoff_requested', 'swap_requested', 'swap_approved', 'swap_declined']);

export function dedupeFanout<T extends { action: string; created_at: string; actor_id: string | null }>(rows: T[]): T[] {
    const seen = new Set<string>();
    return rows.filter((r) => {
        if (!FANOUT.has(r.action)) return true;
        const key = `${r.action}|${r.created_at}|${r.actor_id ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
