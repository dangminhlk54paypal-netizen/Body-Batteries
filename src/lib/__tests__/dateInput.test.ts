import { parseDayMonthInput, formatDayMonthInput } from '../dateInput';

const TODAY = '2026-09-23';

describe('parseDayMonthInput', () => {
  it('accepts / . , - as the separator (a phone decimal-pad has no slash)', () => {
    for (const sep of ['/', '.', ',', '-']) {
      expect(parseDayMonthInput(`12${sep}07`, TODAY)).toBe('2026-07-12');
    }
  });

  it('accepts single-digit day and month and surrounding spaces', () => {
    expect(parseDayMonthInput(' 1.7 ', TODAY)).toBe('2026-07-01');
  });

  it("today itself stays this year; a date later than today rolls back to last year", () => {
    expect(parseDayMonthInput('23.09', TODAY)).toBe('2026-09-23');
    expect(parseDayMonthInput('24.09', TODAY)).toBe('2025-09-24');
    expect(parseDayMonthInput('25.12', TODAY)).toBe('2025-12-25');
  });

  it('rejects days that do not exist instead of rolling into the next month', () => {
    expect(parseDayMonthInput('31.02', TODAY)).toBeNull();
    expect(parseDayMonthInput('31.04', TODAY)).toBeNull();
    expect(parseDayMonthInput('29.02', TODAY)).toBeNull(); // neither 2026 nor 2025 is a leap year
  });

  it('accepts 29.02 when the inferred year is a leap year', () => {
    expect(parseDayMonthInput('29.02', '2028-09-23')).toBe('2028-02-29');
  });

  it('rejects out-of-range and malformed input', () => {
    for (const bad of ['', 'abc', '32.01', '12.13', '0.5', '5.0', '12', '12.7.', '12.07.202', '12.07.2026.1']) {
      expect(parseDayMonthInput(bad, TODAY)).toBeNull();
    }
  });

  it('accepts an explicit 4- or 2-digit year and does not roll it back', () => {
    expect(parseDayMonthInput('12.07.2025', TODAY)).toBe('2025-07-12');
    expect(parseDayMonthInput('12.07.25', TODAY)).toBe('2025-07-12');
    expect(parseDayMonthInput('12/07/2024', TODAY)).toBe('2024-07-12');
    expect(parseDayMonthInput('12.07.2026', TODAY)).toBe('2026-07-12');
  });

  it('rejects an explicit year in the future, or a day that does not exist that year', () => {
    expect(parseDayMonthInput('24.09.2026', TODAY)).toBeNull();
    expect(parseDayMonthInput('01.01.2027', TODAY)).toBeNull();
    expect(parseDayMonthInput('29.02.2025', TODAY)).toBeNull();
    expect(parseDayMonthInput('29.02.2024', TODAY)).toBe('2024-02-29');
  });

  it("order 'md' reads month first (English)", () => {
    expect(parseDayMonthInput('07/12', TODAY, 'md')).toBe('2026-07-12');
    expect(parseDayMonthInput('07/12/2025', TODAY, 'md')).toBe('2025-07-12');
    expect(parseDayMonthInput('12/25', TODAY, 'md')).toBe('2025-12-25');
    // 25 can't be a month, so a day-first "25/12" is invalid month-first.
    expect(parseDayMonthInput('25/12', TODAY, 'md')).toBeNull();
  });
});

describe('formatDayMonthInput', () => {
  it('writes the date the way the user is expected to type it, and round-trips', () => {
    expect(formatDayMonthInput('2026-07-12')).toBe('12.07');
    expect(formatDayMonthInput('2026-07-12', 'md')).toBe('07/12');
    expect(parseDayMonthInput(formatDayMonthInput('2026-07-12'), '2026-09-23')).toBe('2026-07-12');
    expect(parseDayMonthInput(formatDayMonthInput('2026-07-12', 'md'), '2026-09-23', 'md')).toBe('2026-07-12');
  });
});
