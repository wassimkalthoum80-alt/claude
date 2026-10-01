import { describe, expect, it } from 'vitest';
import { dailySeed } from './session';

describe('daily challenge seed', () => {
  it('is the same for a whole UTC day and differs between days', () => {
    const a = dailySeed(new Date('2026-10-01T00:00:00Z'));
    expect(dailySeed(new Date('2026-10-01T23:59:59Z'))).toBe(a);
    expect(dailySeed(new Date('2026-10-02T00:00:00Z'))).not.toBe(a);
    expect(Number.isInteger(a) && a >= 0 && a < 2 ** 32).toBe(true);
  });
});
