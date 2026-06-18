import { dateString, todayString, daysAgo, isToday, daysBetween } from '../dateUtils';

describe('dateString', () => {
  it('formats using local calendar fields as YYYY-MM-DD', () => {
    expect(dateString(new Date(2026, 5, 18))).toBe('2026-06-18'); // June 18 (month is 0-indexed)
  });

  it('pads single-digit months and days', () => {
    expect(dateString(new Date(2026, 0, 2))).toBe('2026-01-02');
  });
});

describe('todayString / daysAgo / isToday', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 5, 1)); // fixed "now": 2026-06-01
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('todayString reflects the current date', () => {
    expect(todayString()).toBe('2026-06-01');
  });

  it('daysAgo(0) is today', () => {
    expect(daysAgo(0)).toBe('2026-06-01');
  });

  it('daysAgo rolls back across a month boundary', () => {
    expect(daysAgo(1)).toBe('2026-05-31');
  });

  it('isToday matches the current date string only', () => {
    expect(isToday('2026-06-01')).toBe(true);
    expect(isToday('2026-05-31')).toBe(false);
  });
});

describe('daysBetween', () => {
  it('computes the absolute number of days between two date strings', () => {
    expect(daysBetween('2026-06-01', '2026-06-08')).toBe(7);
  });

  it('is order-independent', () => {
    expect(daysBetween('2026-06-08', '2026-06-01')).toBe(7);
  });

  it('returns 0 for the same date', () => {
    expect(daysBetween('2026-06-01', '2026-06-01')).toBe(0);
  });
});