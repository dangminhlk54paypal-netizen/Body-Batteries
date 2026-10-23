import {
  addMonthsToDateString,
  computeRetentionSchedule,
  estimateStorage,
  FALLBACK_BYTES_PER_DAY,
  manualCutoff,
} from '../retentionSchedule';

describe('addMonthsToDateString', () => {
  it('adds and subtracts calendar months', () => {
    expect(addMonthsToDateString('2026-01-15', 12)).toBe('2027-01-15');
    expect(addMonthsToDateString('2026-03-01', -3)).toBe('2025-12-01');
  });

  it('clamps to the last day of a shorter month', () => {
    expect(addMonthsToDateString('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToDateString('2028-01-31', 1)).toBe('2028-02-29');
  });
});

describe('computeRetentionSchedule', () => {
  const year = { months: 12, keepFraction: 0.5 } as const;

  it('1 year / keep ½: trims after a year, keeping the newest 6 months', () => {
    const s = computeRetentionSchedule('2026-01-01', year, '2026-06-01')!;
    expect(s.trimDate).toBe('2027-01-01');
    expect(s.cutoffDate).toBe('2026-07-01');
    expect(s.due).toBe(false);
    expect(s.reminders).toEqual([
      { key: '3m', date: '2026-10-01' },
      { key: '1m', date: '2026-12-01' },
      { key: '1w', date: '2026-12-25' },
    ]);
  });

  it('after a trim the next cycle is half a period later', () => {
    const s = computeRetentionSchedule('2026-07-01', year, '2027-01-02')!;
    expect(s.trimDate).toBe('2027-07-01');
    expect(s.cutoffDate).toBe('2027-01-01');
    expect(s.reminders.map((r) => r.key)).toEqual(['3m', '1m', '1w']);
  });

  it('is due on and after the trim date, with no reminders left', () => {
    const s = computeRetentionSchedule('2026-01-01', year, '2027-01-01')!;
    expect(s.due).toBe(true);
    expect(s.reminders).toEqual([]);
  });

  it('drops reminders that would fall before the cycle starts', () => {
    // 3 months / keep ½ → cutoff ≈ 1.5 months before the trim date.
    const s = computeRetentionSchedule('2026-01-01', { months: 3, keepFraction: 0.5 }, '2026-01-02')!;
    expect(s.trimDate).toBe('2026-04-01');
    expect(s.cutoffDate).toBe('2026-02-14');
    expect(s.reminders.map((r) => r.key)).toEqual(['1m', '1w']);
  });

  it('only keeps reminders still ahead of today', () => {
    const s = computeRetentionSchedule('2026-01-01', year, '2026-12-10')!;
    expect(s.reminders).toEqual([{ key: '1w', date: '2026-12-25' }]);
  });

  it('nothing to schedule without data or with "keep everything"', () => {
    expect(computeRetentionSchedule(null, year, '2026-06-01')).toBeNull();
    expect(computeRetentionSchedule('2020-01-01', { months: null, keepFraction: 0.5 }, '2026-06-01')).toBeNull();
  });
});

it('manualCutoff keeps the newest months × fraction counted back from today', () => {
  expect(manualCutoff({ months: 12, keepFraction: 0.5 }, '2026-10-23')).toBe('2026-04-23');
  expect(manualCutoff({ months: 24, keepFraction: 0.75 }, '2026-10-23')).toBe('2025-04-23');
});

describe('estimateStorage', () => {
  it('uses the measured fallback until two weeks of own data exist', () => {
    const e = estimateStorage(50_000, 5, 12);
    expect(e.bytesPerDay).toBe(FALLBACK_BYTES_PER_DAY);
    expect(e.peakBytes).toBe(Math.round(FALLBACK_BYTES_PER_DAY * 12 * 30.44));
  });

  it('averages the real database over the days with data', () => {
    const e = estimateStorage(300 * 1000, 100, 6);
    expect(e.bytesPerDay).toBe(3000);
    expect(e.peakBytes).toBe(Math.round(3000 * 6 * 30.44));
    expect(e.perYearBytes).toBe(3000 * 365);
  });

  it('has no peak for "keep everything"', () => {
    expect(estimateStorage(1, 1, null).peakBytes).toBeNull();
  });
});
