import { addDaysToDateString, dateString } from '../../lib/dateUtils';
import type { DataRetentionSettings, RetentionKeepFraction } from '../../types/dataRetention';

// The retention cycle (Settings → Dữ liệu). With 1 year / keep ½: data piles
// up until the oldest day is 1 year old ("trim date"); then everything before
// the "cutoff" (trim date − 6 months) is backed up and — after the user
// agrees — removed, so the app holds the newest 6 months and the next trim
// date is 6 months later.

export type ReminderKey = '3m' | '1m' | '1w';

export interface RetentionReminder {
  key: ReminderKey;
  date: string; // YYYY-MM-DD
}

export interface RetentionSchedule {
  trimDate: string;
  cutoffDate: string; // rows dated before this are trimmed
  reminders: RetentionReminder[]; // oldest first, only ones still ahead of `today`
  due: boolean; // today >= trimDate
}

// Calendar months, clamped to the month's last day (31.01 + 1 month = 28/29.02).
export function addMonthsToDateString(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const firstOfTarget = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate();
  return dateString(new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), Math.min(d, lastDay)));
}

// `months × fraction` back from `date`: whole months when it is a whole
// number (12 × ½ = 6), otherwise days (3 × ¼ ≈ 23 days).
export function subtractKeepSpan(date: string, months: number, fraction: RetentionKeepFraction): string {
  const span = months * fraction;
  if (Number.isInteger(span)) return addMonthsToDateString(date, -span);
  return addDaysToDateString(date, -Math.round(span * 30.44));
}

const REMINDER_OFFSETS: { key: ReminderKey; back: (trimDate: string) => string }[] = [
  { key: '3m', back: (d) => addMonthsToDateString(d, -3) },
  { key: '1m', back: (d) => addMonthsToDateString(d, -1) },
  { key: '1w', back: (d) => addDaysToDateString(d, -7) },
];

// null = nothing to schedule (no data yet, or "keep everything").
export function computeRetentionSchedule(
  oldestDate: string | null,
  settings: Pick<DataRetentionSettings, 'months' | 'keepFraction'>,
  today: string
): RetentionSchedule | null {
  const { months, keepFraction } = settings;
  if (months == null || oldestDate == null) return null;
  const trimDate = addMonthsToDateString(oldestDate, months);
  const cutoffDate = subtractKeepSpan(trimDate, months, keepFraction);
  // A reminder only makes sense inside the current cycle: after the data
  // began (and after the cutoff the previous trim left), and still ahead.
  const cycleStart = cutoffDate > oldestDate ? cutoffDate : oldestDate;
  const reminders = REMINDER_OFFSETS.map(({ key, back }) => ({ key, date: back(trimDate) })).filter(
    (r) => r.date > cycleStart && r.date > today && r.date < trimDate
  );
  return { trimDate, cutoffDate, reminders, due: today >= trimDate };
}

// The cutoff a manual "Sao lưu & dọn ngay" uses: keep the newest
// `months × fraction` counted back from today.
export function manualCutoff(settings: Pick<DataRetentionSettings, 'months' | 'keepFraction'>, today: string): string {
  return subtractKeepSpan(today, settings.months ?? 12, settings.keepFraction);
}

// Measured on the app's real schema with a heavy day (10 foods, 6 drinks,
// 2 activities, 1 weigh-in, 8 battery rows): ≈ 4 KB/day ≈ 1.5 MB/year. Used
// until the device has two weeks of its own data to average.
export const FALLBACK_BYTES_PER_DAY = 4 * 1024;
const MIN_DAYS_FOR_OWN_AVERAGE = 14;

export interface StorageEstimate {
  currentBytes: number;
  bytesPerDay: number;
  // Size at the top of the cycle (just before a trim); null = keep everything.
  peakBytes: number | null;
  // What one year adds — shown for "keep everything".
  perYearBytes: number;
}

export function estimateStorage(
  dbBytes: number,
  daysWithData: number,
  months: DataRetentionSettings['months']
): StorageEstimate {
  const bytesPerDay = daysWithData >= MIN_DAYS_FOR_OWN_AVERAGE ? dbBytes / daysWithData : FALLBACK_BYTES_PER_DAY;
  return {
    currentBytes: dbBytes,
    bytesPerDay,
    peakBytes: months == null ? null : Math.round(bytesPerDay * months * 30.44),
    perYearBytes: Math.round(bytesPerDay * 365),
  };
}
