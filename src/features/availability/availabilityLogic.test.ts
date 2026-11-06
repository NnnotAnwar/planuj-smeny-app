import { describe, expect, it } from 'vitest';
import { availabilityOn, availabilityWindow } from './availabilityLogic';
import type { Availability } from './types';

const base = { organization_id: 'o', all_day: true, created_at: '2026-11-01T00:00:00Z' };
const entry = (over: Partial<Availability>): Availability =>
    ({ id: Math.random().toString(36), user_id: 'u1', kind: 'unavailable', ...base, ...over }) as Availability;

describe('availabilityOn', () => {
    // 2026-11-04 is a Wednesday (getDay() === 3).
    it('matches a weekly rule by weekday', () => {
        const e = entry({ day_of_week: 3 });
        expect(availabilityOn([e], 'u1', '2026-11-04')).toBe(e);
        expect(availabilityOn([e], 'u1', '2026-11-05')).toBeUndefined();
    });

    it('ignores other members', () => {
        expect(availabilityOn([entry({ day_of_week: 3 })], 'u2', '2026-11-04')).toBeUndefined();
    });

    it('prefers a one-off date over a weekly rule, and "can\'t work" over a wish', () => {
        const weekly = entry({ day_of_week: 3, kind: 'preferred' });
        const oneOff = entry({ specific_date: '2026-11-04', kind: 'preferred' });
        const cant = entry({ day_of_week: 3, kind: 'unavailable' });
        expect(availabilityOn([weekly, oneOff], 'u1', '2026-11-04')).toBe(oneOff);
        expect(availabilityOn([weekly, oneOff, cant], 'u1', '2026-11-04')).toBe(cant);
    });
});

describe('availabilityWindow', () => {
    it('formats a time-bounded entry and blanks an all-day one', () => {
        expect(availabilityWindow({ all_day: false, start_time: '08:00:00', end_time: '12:30:00' })).toBe('08:00–12:30');
        expect(availabilityWindow({ all_day: true, start_time: null, end_time: null })).toBe('');
    });
});
