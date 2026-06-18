import { describe, it, expect } from 'vitest';
import { shiftGrossHours, shiftHours, shiftBreakHours, calculateNetHours, fmtHours, fmtDuration } from './shiftStats';

describe('shiftGrossHours', () => {
    it('computes raw hours for a completed shift', () => {
        expect(shiftGrossHours({ started_at: '2026-06-17T08:00:00Z', ended_at: '2026-06-17T16:00:00Z' })).toBe(8);
    });

    it('counts an open shift up to the provided now', () => {
        const now = new Date('2026-06-17T10:30:00Z').getTime();
        expect(shiftGrossHours({ started_at: '2026-06-17T08:00:00Z', ended_at: null }, now)).toBe(2.5);
    });

    it('never returns a negative duration', () => {
        expect(shiftGrossHours({ started_at: '2026-06-17T16:00:00Z', ended_at: '2026-06-17T08:00:00Z' })).toBe(0);
    });
});

describe('calculateNetHours (Czech mandatory breaks: -30m per started 6h block)', () => {
    it('does not deduct at or below 6h', () => {
        expect(calculateNetHours(0)).toBe(0);
        expect(calculateNetHours(5)).toBe(5);
        expect(calculateNetHours(6)).toBe(6);
    });

    it('deducts 30m once past 6h', () => {
        expect(calculateNetHours(6.5)).toBe(6);
        expect(calculateNetHours(8)).toBe(7.5);
    });

    it('deducts 60m once past 12h', () => {
        expect(calculateNetHours(12.5)).toBe(11.5);
    });
});

describe('shiftHours (net)', () => {
    it('applies the break deduction to an 8h shift', () => {
        expect(shiftHours({ started_at: '2026-06-17T08:00:00Z', ended_at: '2026-06-17T16:00:00Z' })).toBe(7.5);
    });

    it('leaves short shifts untouched', () => {
        expect(shiftHours({ started_at: '2026-06-17T08:00:00Z', ended_at: '2026-06-17T13:00:00Z' })).toBe(5);
    });
});

describe('shiftBreakHours (gross − net)', () => {
    it('is 0 for a short shift and 0.5 for an 8h shift', () => {
        expect(shiftBreakHours({ started_at: '2026-06-17T08:00:00Z', ended_at: '2026-06-17T13:00:00Z' })).toBe(0);
        expect(shiftBreakHours({ started_at: '2026-06-17T08:00:00Z', ended_at: '2026-06-17T16:00:00Z' })).toBe(0.5);
    });
});

describe('fmtHours', () => {
    it('formats integers and one-decimal values', () => {
        expect(fmtHours(124)).toBe('124h');
        expect(fmtHours(7.5)).toBe('7.5h');
        expect(fmtHours(7.46)).toBe('7.5h');
    });
});

describe('fmtDuration', () => {
    it('formats hours and minutes', () => {
        expect(fmtDuration(8.25)).toBe('8h 15m');
        expect(fmtDuration(1)).toBe('1h 0m');
    });

    it('drops the hour part under an hour', () => {
        expect(fmtDuration(0.5)).toBe('30m');
    });
});
