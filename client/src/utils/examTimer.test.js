import { describe, expect, it } from 'vitest';
import { getExamTimeRemainingSeconds } from './examTimer';

describe('exam timer calculation', () => {
  const now = new Date('2026-09-25T12:00:00Z');

  it('uses configured duration when the availability window is longer', () => {
    expect(getExamTimeRemainingSeconds(45, '2026-09-25T14:00:00Z', now)).toBe(45 * 60);
  });

  it('caps duration at the availability deadline', () => {
    expect(getExamTimeRemainingSeconds(60, '2026-09-25T12:10:30Z', now)).toBe(630);
  });

  it('returns zero for an expired deadline and defaults invalid durations to one hour', () => {
    expect(getExamTimeRemainingSeconds(30, '2026-09-25T11:59:00Z', now)).toBe(0);
    expect(getExamTimeRemainingSeconds(0, null, now)).toBe(60 * 60);
  });
});