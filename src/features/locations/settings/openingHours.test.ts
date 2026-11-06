import { describe, expect, it } from 'vitest';
import { fullDayShift, isHoursShift, isOutsideHours, openingHours } from './openingHours';

// Local times, like the rota builds them.
const at = (date: string, hm: string) => new Date(`${date}T${hm}:00`).toISOString();

describe('openingHours', () => {
    it('needs both times', () => {
        expect(openingHours('09:00', null)).toBeNull();
        expect(openingHours(null, '22:00')).toBeNull();
        expect(openingHours('09:00:00', '22:00:00')).toEqual({ open: '09:00', close: '22:00' });
    });
});

describe('isOutsideHours', () => {
    const day = openingHours('09:00', '22:00');
    const bar = openingHours('18:00', '02:00'); // closes after midnight

    it('accepts a shift inside the hours, including the exact edges', () => {
        expect(isOutsideHours(at('2026-11-10', '09:00'), at('2026-11-10', '17:30'), day)).toBe(false);
        expect(isOutsideHours(at('2026-11-10', '14:00'), at('2026-11-10', '22:00'), day)).toBe(false);
    });

    it('flags a shift that starts early or ends late', () => {
        expect(isOutsideHours(at('2026-11-10', '08:00'), at('2026-11-10', '16:00'), day)).toBe(true);
        expect(isOutsideHours(at('2026-11-10', '15:00'), at('2026-11-10', '23:00'), day)).toBe(true);
    });

    it('handles places that close after midnight', () => {
        expect(isOutsideHours(at('2026-11-10', '18:00'), at('2026-11-11', '02:00'), bar)).toBe(false);
        // Starts after midnight, inside the window that opened the evening before.
        expect(isOutsideHours(at('2026-11-11', '00:30'), at('2026-11-11', '02:00'), bar)).toBe(false);
        expect(isOutsideHours(at('2026-11-10', '17:00'), at('2026-11-11', '01:00'), bar)).toBe(true);
        expect(isOutsideHours(at('2026-11-10', '20:00'), at('2026-11-11', '03:00'), bar)).toBe(true);
    });

    it('never flags all-day shifts or places without hours', () => {
        expect(isOutsideHours(at('2026-11-10', '00:00'), at('2026-11-11', '00:00'), day, true)).toBe(false);
        expect(isOutsideHours(at('2026-11-10', '06:00'), at('2026-11-10', '23:00'), null)).toBe(false);
    });
});

describe('full-day shifts (the location letter)', () => {
    const day = openingHours('11:00', '23:00');
    const bar = openingHours('18:00', '02:00');

    it('uses the opening hours as real times', () => {
        expect(fullDayShift('2026-11-10', day)).toEqual({ starts_at: at('2026-11-10', '11:00'), ends_at: at('2026-11-10', '23:00'), all_day: false });
        expect(fullDayShift('2026-11-10', bar).ends_at).toBe(at('2026-11-11', '02:00'));
    });

    it('falls back to an all-day mark without hours', () => {
        const s = fullDayShift('2026-11-10', null);
        expect(s.all_day).toBe(true);
        expect(s.starts_at).toBe(new Date(2026, 10, 10).toISOString());
    });

    it('recognises a shift that matches the hours exactly', () => {
        const s = fullDayShift('2026-11-10', day);
        expect(isHoursShift(s.starts_at, s.ends_at, s.all_day, day)).toBe(true);
        expect(isHoursShift(at('2026-11-10', '11:00'), at('2026-11-10', '22:00'), false, day)).toBe(false);
        expect(isHoursShift(s.starts_at, s.ends_at, false, null)).toBe(false);
        const b = fullDayShift('2026-11-10', bar);
        expect(isHoursShift(b.starts_at, b.ends_at, false, bar)).toBe(true);
    });
});
