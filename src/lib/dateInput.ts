import { dateString } from './dateUtils';

// Parses a hand-typed date into YYYY-MM-DD, or null when it isn't a real date.
//
//   "12.07"       day.month — the year is inferred from `today`
//   "12.07.2026"  or "12.07.26" — an explicit year (4 digits, or 2 → 20xx)
//
// The separator can be / . , or - : a phone's number keyboard has a comma or a
// dot but often no slash, and the user writes dates as "12.07" in their notes.
// `order: 'md'` reads the same shapes month-first ("07/12") for English, where
// the app itself shows dates as month/day.
//
// Without a year: the current year, or the previous one when that would land in
// the future — so a date up to a year back just works. With a year: exactly
// that year, and it must not be in the future. A day that doesn't exist
// ("31.02", "29.02" in a non-leap year) is rejected rather than rolled over
// into the next month the way `new Date(2026, 1, 31)` would. `today` is a
// parameter so callers stay pure.
export function parseDayMonthInput(
  input: string,
  today: string,
  order: 'dm' | 'md' = 'dm'
): string | null {
  const match = /^(\d{1,2})[/.,-](\d{1,2})(?:[/.,-](\d{4}|\d{2}))?$/.exec(input.trim());
  if (!match) return null;
  const first = parseInt(match[1], 10);
  const second = parseInt(match[2], 10);
  const day = order === 'dm' ? first : second;
  const month = order === 'dm' ? second : first;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  const build = (year: number): string | null => {
    const d = new Date(year, month - 1, day, 0, 0, 0, 0);
    // Rolled over (Feb 31 → Mar 3) means the day doesn't exist that year.
    return d.getDate() === day && d.getMonth() === month - 1 ? dateString(d) : null;
  };

  if (match[3] != null) {
    const year = match[3].length === 2 ? 2000 + parseInt(match[3], 10) : parseInt(match[3], 10);
    const explicit = build(year);
    return explicit && explicit <= today ? explicit : null;
  }

  const thisYear = parseInt(today.slice(0, 4), 10);
  const candidate = build(thisYear);
  if (candidate && candidate <= today) return candidate;
  return build(thisYear - 1);
}

// The inverse of parseDayMonthInput for an editor's initial text: "12.07"
// day-first, "07/12" month-first — so a suggested date reads the same way the
// user is expected to type it.
export function formatDayMonthInput(date: string, order: 'dm' | 'md' = 'dm'): string {
  const [, mm, dd] = date.split('-');
  return order === 'dm' ? `${dd}.${mm}` : `${mm}/${dd}`;
}
