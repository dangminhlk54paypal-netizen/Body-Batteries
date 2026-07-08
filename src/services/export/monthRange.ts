import { dateString } from '../../lib/dateUtils';

// Pure, I/O-free date-range helpers for the month-scoped exports. Kept apart
// from excelExportService so they can be unit-tested without pulling in the
// expo-file-system / xlsx runtime.

export interface MonthRange {
  from: string; // YYYY-MM-DD, first day of the previous month
  to: string; // YYYY-MM-DD, last day of the previous month
  mm: string; // 2-digit month of the previous month
  yyyy: string; // 4-digit year of the previous month
  marker: string; // YYYY-MM of the CURRENT month (the export marker)
  filename: string; // your_daily_batteries_body_on_MM_YYYY.xlsx
}

// "YYYY-MM" of the given date's month. Stored as the last-exported marker so a
// monthly auto-export runs at most once per calendar month.
export function monthMarker(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// Full calendar range of the month *before* `now` (handles Jan -> prev Dec and
// leap-year February via the JS Date normalisation of month/day overflow).
export function previousMonthRange(now: Date = new Date()): MonthRange {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11, the current month
  const first = new Date(year, month - 1, 1); // 1st of the previous month
  const last = new Date(year, month, 0); // day 0 of this month = last of prev
  const mm = String(first.getMonth() + 1).padStart(2, '0');
  const yyyy = String(first.getFullYear());
  return {
    from: dateString(first),
    to: dateString(last),
    mm,
    yyyy,
    marker: monthMarker(now),
    filename: `your_daily_batteries_body_on_${mm}_${yyyy}.xlsx`,
  };
}
