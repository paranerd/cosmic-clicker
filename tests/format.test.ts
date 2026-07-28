import { describe, expect, it } from 'vitest';
import { formatEnergy, formatTemperature } from '../src/ui/format';

describe('energy formatting', () => {
  it('always displays whole energy units rounded down', () => {
    expect(formatEnergy(0)).toBe('0');
    expect(formatEnergy(.99)).toBe('0');
    expect(formatEnergy(1)).toBe('1');
    expect(formatEnergy(1.99)).toBe('1');
    expect(formatEnergy(1_234.99)).toBe('1.234');
  });
});

describe('temperature formatting', () => {
  it('always displays whole temperature values', () => {
    expect(formatTemperature(2_700.6)).toBe('2.701 K');
    expect(formatTemperature(1_600_000)).toBe('2 Mio. K');
    expect(formatTemperature(1_600_000_000)).toBe('2 Mrd. K');
  });
});
