import { describe, expect, it } from 'vitest';
import { restIssues, restIssuesFor, type RestShift } from './restRules';

const at = (date: string, hm: string) => new Date(`${date}T${hm}:00`).toISOString();
let n = 0;
const shift = (user: string, date: string, start: string, endDate: string, end: string, allDay = false): RestShift => ({
    id: `s${++n}`,
    user_id: user,
    starts_at: at(date, start),
    ends_at: at(endDate, end),
    all_day: allDay,
});
const allDay = (user: string, date: string) => {
    const [y, m, d] = date.split('-').map(Number);
    return { id: `s${++n}`, user_id: user, starts_at: new Date(y, m - 1, d).toISOString(), ends_at: new Date(y, m - 1, d + 1).toISOString(), all_day: true };
};

describe('restIssues — 11-hour rule', () => {
    it('flags a close followed by an early open', () => {
        const close = shift('a', '2026-11-10', '15:00', '2026-11-10', '23:00');
        const open = shift('a', '2026-11-11', '07:00', '2026-11-11', '15:00');
        expect(restIssues([close, open]).get(open.id)).toEqual([{ kind: 'short-rest', hours: 8 }]);
        expect(restIssues([close, open]).get(close.id)).toBeUndefined();
    });

    it('accepts exactly 11 hours and ignores other people', () => {
        const a1 = shift('a', '2026-11-10', '12:00', '2026-11-10', '20:00');
        const a2 = shift('a', '2026-11-11', '07:00', '2026-11-11', '15:00');
        const b1 = shift('b', '2026-11-11', '01:00', '2026-11-11', '06:00');
        expect(restIssues([a1, a2, b1]).size).toBe(0);
    });

    it('skips all-day shifts for the hour rule', () => {
        const d1 = allDay('a', '2026-11-10');
        const d2 = shift('a', '2026-11-11', '06:00', '2026-11-11', '14:00');
        expect(restIssues([d1, d2]).size).toBe(0);
    });
});

describe('restIssues — days in a row', () => {
    it('flags day 7 onward of an unbroken run', () => {
        const run = ['01', '02', '03', '04', '05', '06', '07', '08'].map((d) => allDay('a', `2026-12-${d}`));
        const issues = restIssues(run);
        expect(issues.get(run[5].id)).toBeUndefined();
        expect(issues.get(run[6].id)).toEqual([{ kind: 'streak', day: 7 }]);
        expect(issues.get(run[7].id)).toEqual([{ kind: 'streak', day: 8 }]);
    });

    it('a day off resets the run', () => {
        const days = ['01', '02', '03', '05', '06', '07', '08', '09', '10'].map((d) => allDay('a', `2026-12-${d}`));
        expect(restIssues(days).size).toBe(0);
    });
});

describe('restIssuesFor (editor preview)', () => {
    it('warns about the rest before and after the new shift', () => {
        const before = shift('a', '2026-11-10', '14:00', '2026-11-10', '22:00');
        const after = shift('a', '2026-11-12', '06:00', '2026-11-12', '14:00');
        const candidate = { user_id: 'a', starts_at: at('2026-11-11', '06:00'), ends_at: at('2026-11-11', '22:00'), all_day: false };
        expect(restIssuesFor(candidate, [before, after])).toEqual([
            { kind: 'short-rest', hours: 8 },
            { kind: 'short-rest', hours: 8 },
        ]);
    });
});
