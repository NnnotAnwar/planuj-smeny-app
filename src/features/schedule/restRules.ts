/**
 * --- REST RULES (Czech labour code) ---
 * Warnings for the planner, never blocks:
 *   • §90 — at least 11 h of continuous rest between two shifts.
 *   • §92 — weekly rest; we flag the practical symptom: more than 6 working days
 *     in a row without a day off.
 * Pure functions over a member's planned shifts. All-day shifts have no real
 * times, so they count for the streak but not for the 11-hour rule.
 */

export const MIN_REST_HOURS = 11;
export const MAX_DAYS_IN_A_ROW = 6;

export type RestIssue =
    | { kind: 'short-rest'; hours: number } // rest before this shift, rounded down to 0.5 h
    | { kind: 'streak'; day: number }; // this shift is on day N of an unbroken run (N > 6)

export interface RestShift {
    id: string;
    user_id: string;
    starts_at: string;
    ends_at: string;
    all_day: boolean;
}

const HOUR = 3_600_000;

const localDayKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const nextDayKey = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return localDayKey(new Date(y, m - 1, d + 1).toISOString());
};

/** Rest in hours between the end of `prev` and the start of `next`, rounded down to 0.5 h. */
const restHours = (prev: RestShift, next: RestShift) => Math.floor(((Date.parse(next.starts_at) - Date.parse(prev.ends_at)) / HOUR) * 2) / 2;

/**
 * Every rest problem in a set of planned shifts, keyed by the shift it lands on
 * (the later shift of a short-rest pair; days 7+ of a streak).
 */
export function restIssues(shifts: RestShift[]): Map<string, RestIssue[]> {
    const out = new Map<string, RestIssue[]>();
    const add = (id: string, issue: RestIssue) => out.set(id, [...(out.get(id) ?? []), issue]);

    const byUser = new Map<string, RestShift[]>();
    for (const s of shifts) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

    for (const list of byUser.values()) {
        const sorted = [...list].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));

        // 11-hour rule — consecutive timed shifts only.
        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const next = sorted[i];
            if (prev.all_day || next.all_day) continue;
            const h = restHours(prev, next);
            if (h >= 0 && h < MIN_REST_HOURS) add(next.id, { kind: 'short-rest', hours: h });
        }

        // Days in a row — count distinct local working days.
        const dayShifts = new Map<string, RestShift[]>();
        for (const s of sorted) {
            const k = localDayKey(s.starts_at);
            dayShifts.set(k, [...(dayShifts.get(k) ?? []), s]);
        }
        const days = [...dayShifts.keys()].sort();
        let run = 0;
        let prevKey: string | null = null;
        for (const k of days) {
            run = prevKey && nextDayKey(prevKey) === k ? run + 1 : 1;
            prevKey = k;
            if (run > MAX_DAYS_IN_A_ROW) for (const s of dayShifts.get(k)!) add(s.id, { kind: 'streak', day: run });
        }
    }
    return out;
}

/**
 * Rest problems a not-yet-saved shift would have, against the member's other
 * planned shifts (used by the day editor before saving).
 */
export function restIssuesFor(candidate: Omit<RestShift, 'id'>, others: RestShift[]): RestIssue[] {
    const probe = { ...candidate, id: '__candidate__' };
    const mine = others.filter((s) => s.user_id === candidate.user_id);
    const issues = [...(restIssues([...mine, probe]).get(probe.id) ?? [])];
    // The candidate can also be the shift *before* a too-close later one.
    if (!candidate.all_day) {
        const later = mine
            .filter((s) => !s.all_day && Date.parse(s.starts_at) >= Date.parse(candidate.ends_at))
            .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0];
        if (later) {
            const h = restHours(probe, later);
            if (h < MIN_REST_HOURS) issues.push({ kind: 'short-rest', hours: h });
        }
    }
    return issues;
}
