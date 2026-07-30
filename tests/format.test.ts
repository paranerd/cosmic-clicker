import { describe, expect, it } from 'vitest';
import { formatChamberValue, formatEnergy, formatTemperature } from '../src/ui/format';

describe('energy formatting', () => {
  it('always displays whole energy units rounded down', () => {
    expect(formatEnergy(0)).toBe('0');
    expect(formatEnergy(.99)).toBe('0');
    expect(formatEnergy(1)).toBe('1');
    expect(formatEnergy(1.99)).toBe('1');
    expect(formatEnergy(1_234.99)).toBe('1.234');
  });
});

describe('chamber resource formatting', () => {
  it('keeps values below a million fully written out', () => {
    expect(formatChamberValue(0)).toBe('0');
    expect(formatChamberValue(999_999)).toBe('999.999');
  });

  it('abbreviates millions and billions with two decimals', () => {
    expect(formatChamberValue(1_000_000)).toBe('1,00 Mio');
    expect(formatChamberValue(1_234_567)).toBe('1,23 Mio');
    expect(formatChamberValue(120_000_000)).toBe('120,00 Mio');
    expect(formatChamberValue(2_700_000_000)).toBe('2,70 Mrd');
  });
});

describe('temperature formatting', () => {
  it('always displays whole temperature values', () => {
    expect(formatTemperature(2_700.6)).toBe('2.701 K');
    expect(formatTemperature(1_600_000)).toBe('2 Mio. K');
    expect(formatTemperature(1_600_000_000)).toBe('2 Mrd. K');
  });
});
