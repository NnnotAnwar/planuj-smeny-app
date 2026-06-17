import { describe, it, expect } from 'vitest';
import { shiftHours, fmtHours, fmtDuration } from './shiftStats';

describe('shiftHours', () => {
    it('computes hours for a completed shift', () => {
        expect(shiftHours({ started_at: '2026-06-17T08:00:00Z', ended_at: '2026-06-17T16:00:00Z' })).toBe(8);
    });

    it('counts an open shift up to the provided now', () => {
        const now = new Date('2026-06-17T10:30:00Z').getTime();
        expect(shiftHours({ started_at: '2026-06-17T08:00:00Z', ended_at: null }, now)).toBe(2.5);
    });

    it('never returns a negative duration', () => {
        expect(shiftHours({ started_at: '2026-06-17T16:00:00Z', ended_at: '2026-06-17T08:00:00Z' })).toBe(0);
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
