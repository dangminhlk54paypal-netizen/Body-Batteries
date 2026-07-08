import { previousMonthRange, monthMarker } from '../monthRange';

describe('previousMonthRange', () => {
  it('maps a mid-July date to the whole previous June', () => {
    const r = previousMonthRange(new Date(2026, 6, 8)); // 2026-07-08
    expect(r.from).toBe('2026-06-01');
    expect(r.to).toBe('2026-06-30');
    expect(r.mm).toBe('06');
    expect(r.yyyy).toBe('2026');
    expect(r.filename).toBe('your_daily_batteries_body_on_06_2026.xlsx');
    // Marker is the CURRENT month so we don't re-export until next month.
    expect(r.marker).toBe('2026-07');
  });

  it('rolls January back to the previous December of the previous year', () => {
    const r = previousMonthRange(new Date(2026, 0, 15)); // 2026-01-15
    expect(r.from).toBe('2025-12-01');
    expect(r.to).toBe('2025-12-31');
    expect(r.mm).toBe('12');
    expect(r.yyyy).toBe('2025');
    expect(r.filename).toBe('your_daily_batteries_body_on_12_2025.xlsx');
    expect(r.marker).toBe('2026-01');
  });

  it('2-digit pads a single-digit previous month (March -> February)', () => {
    const r = previousMonthRange(new Date(2026, 2, 10)); // 2026-03-10
    expect(r.from).toBe('2026-02-01');
    expect(r.to).toBe('2026-02-28');
    expect(r.mm).toBe('02');
    expect(r.marker).toBe('2026-03');
  });

  it('handles the leap-year February end day', () => {
    const r = previousMonthRange(new Date(2024, 2, 5)); // 2024-03-05
    expect(r.from).toBe('2024-02-01');
    expect(r.to).toBe('2024-02-29');
    expect(r.mm).toBe('02');
    expect(r.yyyy).toBe('2024');
  });
});

describe('monthMarker', () => {
  it('formats YYYY-MM with a 2-digit month', () => {
    expect(monthMarker(new Date(2026, 2, 5))).toBe('2026-03');
    expect(monthMarker(new Date(2026, 11, 31))).toBe('2026-12');
  });
});
