import { describe, it, expect } from 'vitest';
import { estimatePay } from './types';

describe('estimatePay', () => {
  it('multiplies hours by rate', () => {
    expect(estimatePay(10, 150)).toBe(1500);
  });

  it('rounds to 2 decimals (no float drift)', () => {
    // 7.35 * 3 = 22.049999… → 22.05
    expect(estimatePay(3, 7.35)).toBe(22.05);
  });

  it('handles zero hours and zero rate', () => {
    expect(estimatePay(0, 200)).toBe(0);
    expect(estimatePay(8, 0)).toBe(0);
  });

  it('supports fractional hours', () => {
    expect(estimatePay(8.5, 200)).toBe(1700);
  });
});
