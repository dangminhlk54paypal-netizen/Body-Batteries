import type { ActivityLogEntry, ActivityType } from '../../types/energy';

// "As usual" prefill for the activity sheet: people tend to repeat an
// activity in the same context — often around the same time of day
// (docs/nghien-cuu/2026-09-26-ghi-van-dong-gon-va-dien-san.md). From the last
// few weeks of the user's OWN log, find the activity they usually do around
// this time and its usual length / start time. Pure: the sheet loads history
// and applies the result as editable defaults.

export interface ActivityPrefill {
  type: ActivityType; // 'custom' → customName/customMet identify it
  customName?: string;
  customMet?: number;
  minutes: number;
  startTime?: string; // "HH:mm", only when the user usually records times
  endTime?: string;
  days: number; // distinct past days it matched (≥ MIN_HABIT_DAYS)
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const LOOKBACK_DAYS = 28;
export const TIME_WINDOW_MIN = 120; // "around this time" = within 2 h of the usual window
export const MIN_HABIT_DAYS = 2; // once is a one-off, twice starts a pattern

// Set-based lifting and muscle-group bodybuilding have their own sheets.
const SKIP_TYPES: ActivityType[] = ['squat', 'bench_press', 'deadlift', 'bodybuilding'];

function minuteOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

function sameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function roundTo5(n: number): number {
  return Math.max(5, Math.round(n / 5) * 5);
}

export function formatHHmm(minuteOfDayValue: number): string {
  const m = ((Math.round(minuteOfDayValue) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

interface Match {
  key: string;
  type: ActivityType;
  customName?: string;
  customMet?: number;
  minutes: number;
  start?: number; // minute of day, only when startAt was recorded
  day: string;
  weight: number;
}

export function suggestActivityPrefill(history: ActivityLogEntry[], now: number): ActivityPrefill | null {
  const nowMin = minuteOfDay(now);
  const nowDow = new Date(now).getDay();
  const matches: Match[] = [];

  for (const e of history) {
    const when = e.startAt ?? e.timestamp;
    const age = now - when;
    if (age < 0 || age > LOOKBACK_DAYS * DAY_MS || sameDay(when, now)) continue;
    const w = e.workouts.find((x) => !x.sets && !SKIP_TYPES.includes(x.type) && x.minutes > 0);
    if (!w) continue;
    const start = minuteOfDay(when);
    const end = e.endAt ? minuteOfDay(e.endAt) : start + w.minutes;
    if (nowMin < start - TIME_WINDOW_MIN || nowMin > end + TIME_WINDOW_MIN) continue;
    const recency = 1 - (age / (LOOKBACK_DAYS * DAY_MS)) * 0.5; // last week counts more
    const weekday = new Date(when).getDay() === nowDow ? 0.5 : 0;
    matches.push({
      key: w.type === 'custom' ? `custom:${w.customName ?? ''}` : w.type,
      type: w.type,
      customName: w.customName,
      customMet: w.customMet,
      minutes: w.minutes,
      start: e.startAt !== undefined ? start : undefined,
      day: new Date(when).toDateString(),
      weight: recency + weekday,
    });
  }

  const byKey = new Map<string, Match[]>();
  for (const m of matches) byKey.set(m.key, [...(byKey.get(m.key) ?? []), m]);

  let best: Match[] | null = null;
  let bestScore = 0;
  for (const group of byKey.values()) {
    if (new Set(group.map((m) => m.day)).size < MIN_HABIT_DAYS) continue;
    const score = group.reduce((s, m) => s + m.weight, 0);
    if (score > bestScore) {
      best = group;
      bestScore = score;
    }
  }
  if (!best) return null;

  const minutes = roundTo5(median(best.map((m) => m.minutes)));
  const starts = best.map((m) => m.start).filter((s): s is number => s !== undefined);
  const start = starts.length >= MIN_HABIT_DAYS ? roundTo5(median(starts)) : undefined;
  const first = best[0];
  return {
    type: first.type,
    customName: first.customName,
    customMet: first.customMet,
    minutes,
    startTime: start !== undefined ? formatHHmm(start) : undefined,
    endTime: start !== undefined ? formatHHmm(start + minutes) : undefined,
    days: new Set(best.map((m) => m.day)).size,
  };
}
