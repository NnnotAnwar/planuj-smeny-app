import { describe, it, expect } from 'vitest';
import { quickFillDays, copyTargetDay, firstDowOffset, monthDayCount, mondayFirstDow } from './scheduleLogic';

describe('mondayFirstDow', () => {
    it('maps Monday→0 … Sunday→6', () => {
        // 2026-06-01 is a Monday.
        expect(mondayFirstDow(new Date(2026, 5, 1))).toBe(0);
        expect(mondayFirstDow(new Date(2026, 5, 7))).toBe(6); // Sunday
    });
});

describe('monthDayCount', () => {
    it('counts days incl. leap February', () => {
        expect(monthDayCount('2026-07')).toBe(31);
        expect(monthDayCount('2026-02')).toBe(28);
        expect(monthDayCount('2028-02')).toBe(29); // leap year
    });
});

describe('quickFillDays (restaurant short/long week alternation)', () => {
    it('short and long together cover every day, with no overlap', () => {
        const all = Array.from({ length: monthDayCount('2026-07') }, (_, i) => i + 1);
        const short = quickFillDays('2026-07', 'short');
        const long = quickFillDays('2026-07', 'long');
        expect([...short, ...long].sort((a, b) => a - b)).toEqual(all);
        expect(short.filter((d) => long.includes(d))).toEqual([]);
    });

    it('starts short: week 0 fills only Wed+Thu', () => {
        // 2026-07-01 is Wednesday (week 0). Short week = Wed+Thu only.
        const short = quickFillDays('2026-07', 'short');
        expect(short).toContain(1); // Wed
        expect(short).toContain(2); // Thu
        expect(short).not.toContain(3); // Fri — excluded in a short week
    });

    it('alternates: the next week flips to the long pattern', () => {
        // Week 1 is a long week under 'short': Wed(8)/Thu(9) are NOT filled,
        // but Mon(6), Tue(7), Fri(10), Sat(11), Sun(12) are.
        const short = quickFillDays('2026-07', 'short');
        expect(short).not.toContain(8); // Wed of long week
        expect(short).not.toContain(9); // Thu of long week
        [6, 7, 10, 11, 12].forEach((d) => expect(short).toContain(d));
    });

    it("'long' is the exact inverse of 'short' for the same month", () => {
        const short = quickFillDays('2026-07', 'short');
        const long = quickFillDays('2026-07', 'long');
        // Fri wk0: excluded by short, included by long.
        expect(short).not.toContain(3);
        expect(long).toContain(3);
        // Wed wk0: included by short, excluded by long.
        expect(short).toContain(1);
        expect(long).not.toContain(1);
    });
});

describe('copyTargetDay (week-index × weekday mapping)', () => {
    it('is the identity when source and target months start on the same weekday', () => {
        const off = firstDowOffset('2026-06');
        for (const d of [1, 8, 15, 22, 30]) {
            expect(copyTargetDay(new Date(2026, 5, d), off, off)).toBe(d);
        }
    });

    it('shifts by the difference in month-start offsets', () => {
        const prevOffset = firstDowOffset('2026-06');
        // A target month starting two weekdays earlier moves each slot +2 days.
        expect(copyTargetDay(new Date(2026, 5, 10), prevOffset, prevOffset - 2)).toBe(12);
    });
});
