import { LOCALE_TAGS } from '../i18n/types';
import type { Language } from '../i18n/types';

// Format a Date as YYYY-MM-DD using LOCAL calendar fields. Using toISOString()
// here would key data by the UTC day, which rolls over at the wrong moment for
// any non-UTC timezone (e.g. an evening intake could land on "tomorrow").
export function dateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayString(): string {
  return dateString(new Date());
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateString(d);
}

export function isToday(dateStr: string): boolean {
  return dateStr === todayString();
}

export function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / msPerDay;
}

export function formatDisplayDate(dateStr: string, language: Language): string {
  // Parse as local midnight ('YYYY-MM-DD' alone is parsed as UTC, which can
  // render the previous day's weekday in negative-offset displays).
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(LOCALE_TAGS[language], {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

const DMY_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// Formats a YYYY-MM-DD date string as "D-MMM-YYYY" (no leading zero on the
// day, 3-letter English month, e.g. "1-Apr-2021"). Used by the Excel export
// (Daily Totals / Food Entries sheets) which needs an English, sortable-ish
// date label independent of the device locale.
export function formatDMY(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()}-${DMY_MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

export function nowTimestamp(): number {
  return Date.now();
}

// Parses a "HH:mm" (24h) time string into a unix ms timestamp anchored to
// TODAY's local calendar date. Used by the activity-logging UI (F2) to turn
// a simple text time field into startAt/endAt without adding a native
// date/time-picker dependency. Returns undefined for empty/invalid input so
// callers can treat it as "not specified" (falls back to "now").
export function parseTimeHHmmToday(value: string): number | undefined {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

// Inverse of parseTimeHHmmToday: formats a unix ms timestamp as "HH:mm"
// (local time) for display or for prefilling an edit form.
export function formatTimeHHmm(timestamp: number): string {
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// The "energy day" rolls over at 6am instead of midnight: before the reset
// hour still counts as the previous day (a 1am snack belongs to that day's
// calorie ledger). ONLY the calorie ledger keys by this — nutrient batteries,
// History and export keep the calendar day (todayString) untouched.
export function energyDayString(date: Date = new Date(), resetHour = 6): string {
  const shifted = new Date(date);
  if (shifted.getHours() < resetHour) {
    shifted.setDate(shifted.getDate() - 1);
  }
  return dateString(shifted);
}
