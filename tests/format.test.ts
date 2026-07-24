import { describe, expect, it } from 'vitest';
import { formatEnergy } from '../src/ui/format';

describe('energy formatting', () => {
  it('always displays whole energy units rounded down', () => {
    expect(formatEnergy(0)).toBe('0');
    expect(formatEnergy(.99)).toBe('0');
    expect(formatEnergy(1)).toBe('1');
    expect(formatEnergy(1.99)).toBe('1');
    expect(formatEnergy(1_234.99)).toBe('1.234');
  });
});
