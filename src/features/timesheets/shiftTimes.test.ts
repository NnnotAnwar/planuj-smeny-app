import { describe, it, expect } from 'vitest';
import { buildShiftDates } from './shiftTimes';

describe('buildShiftDates — same-day shifts', () => {
    it('returns end after start for a normal shift', () => {
        const { startDate, endDate } = buildShiftDates('2026-01-15', '08:00', '16:00');
        expect(endDate > startDate).toBe(true);
        expect(endDate.getTime() - startDate.getTime()).toBe(8 * 60 * 60 * 1000);
    });

    it('preserves the requested start date', () => {
        const { startDate } = buildShiftDates('2026-03-10', '09:00', '17:00');
        expect(startDate.getFullYear()).toBe(2026);
        expect(startDate.getMonth()).toBe(2); // March is index 2
        expect(startDate.getDate()).toBe(10);
    });

    it('short shift under 1 h is not treated as overnight', () => {
        const { startDate, endDate } = buildShiftDates('2026-01-15', '07:00', '07:30');
        expect(endDate.getTime() - startDate.getTime()).toBe(30 * 60 * 1000);
    });
});

describe('buildShiftDates — overnight shifts', () => {
    it('adds 24 h when end time is before start time', () => {
        const { startDate, endDate } = buildShiftDates('2026-01-15', '22:00', '06:00');
        expect(endDate > startDate).toBe(true);
        expect(endDate.getTime() - startDate.getTime()).toBe(8 * 60 * 60 * 1000);
    });

    it('adds 24 h when end time equals start time (ambiguous → overnight)', () => {
        const { startDate, endDate } = buildShiftDates('2026-01-15', '09:00', '09:00');
        expect(endDate.getTime() - startDate.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it('handles end one minute before start', () => {
        const { startDate, endDate } = buildShiftDates('2026-01-15', '12:00', '11:59');
        expect(endDate > startDate).toBe(true);
        expect(endDate.getTime() - startDate.getTime()).toBe(23 * 60 * 60 * 1000 + 59 * 60 * 1000);
    });

    it('handles 23:00 → 07:00 cross-midnight', () => {
        const { startDate, endDate } = buildShiftDates('2026-01-15', '23:00', '07:00');
        expect(endDate.getTime() - startDate.getTime()).toBe(8 * 60 * 60 * 1000);
    });

    it('overnight end lands on the next calendar day', () => {
        const { startDate, endDate } = buildShiftDates('2026-01-31', '22:00', '02:00');
        expect(startDate.getDate()).toBe(31);
        expect(endDate.getDate()).toBe(1);   // Feb 1
        expect(endDate.getMonth()).toBe(1);  // February (0-indexed)
    });
});
