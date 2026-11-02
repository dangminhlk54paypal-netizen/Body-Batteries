// Routine detection + auto-fill helpers (pure, no I/O).
//
// Idea: the user logs roughly the same sleep / water / steps / walking time
// every day. If a metric has been logged on >= MIN_STREAK_DAYS consecutive
// days (ending yesterday) with similar values, it counts as a "routine" and
// the app can pre-fill it for today — either by asking at a set time of day
// (prompt mode) or by filling it directly (auto mode). See
// docs/09-routine-autofill.md.

import type { IntakeEvent } from '../../types/battery';
import { dateString } from '../../lib/dateUtils';

export type RoutineMetric = 'sleep' | 'water' | 'steps' | 'walkMinutes';

export const ROUTINE_METRICS: RoutineMetric[] = ['sleep', 'water', 'steps', 'walkMinutes'];

// 'off'    — user logs manually; only the "💡 Gợi ý" button is offered.
// 'prompt' — at the morning / evening window the Home screen shows a
//            pre-filled check-in card the user confirms.
// 'auto'   — routine metrics are logged automatically (with undo).
export type RoutineMode = 'off' | 'prompt' | 'auto';

export const MIN_STREAK_DAYS = 3;
export const MAX_LOOKBACK_DAYS = 7;
// A streak only counts as a routine if every day is within ±30% of the median.
export const ROUTINE_TOLERANCE = 0.3;

export interface TimeWindow {
  startHour: number; // inclusive, local hour
  endHour: number; // exclusive
}

// Default check-in windows: morning asks about last night's sleep, evening
// asks about water drunk + steps / walking time.
export const DEFAULT_ROUTINE_WINDOWS: Record<'morning' | 'evening', TimeWindow> = {
  morning: { startHour: 6, endHour: 8 },
  evening: { startHour: 20, endHour: 22 },
};

export type RoutineSlot = 'morning' | 'evening';

// Which metrics belong to which check-in slot.
export const SLOT_METRICS: Record<RoutineSlot, RoutineMetric[]> = {
  morning: ['sleep'],
  evening: ['water', 'steps', 'walkMinutes'],
};

const ROUNDING_STEP: Record<RoutineMetric, number> = {
  sleep: 0.25,
  water: 50,
  steps: 100,
  walkMinutes: 5,
};

// Workout notes written by energyStore.logActivity look like
// "workout: walking 30m". Walking + brisk walking both count as walking time.
const WALK_NOTE_RE = /^workout: (walking|brisk_walking) (\d+(?:\.\d+)?)m$/;

export interface RoutineInsight {
  metric: RoutineMetric;
  streakDays: number; // consecutive logged days ending yesterday (≤ MAX_LOOKBACK_DAYS)
  isRoutine: boolean; // streak long enough AND values stable
  suggested: number | null; // median of recent logged days (rounded), null if no history
  loggedToday: number; // amount already logged today
}

export type RoutineInsights = Record<RoutineMetric, RoutineInsight>;

export function roundForMetric(metric: RoutineMetric, value: number): number {
  const step = ROUNDING_STEP[metric];
  return Math.round(value / step) * step;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Amount an intake event contributes to a metric (0 if unrelated).
export function metricAmount(event: IntakeEvent, metric: RoutineMetric): number {
  switch (metric) {
    case 'sleep':
      return event.batteryTypeId === 'sleep' ? event.amount : 0;
    case 'water':
      return event.batteryTypeId === 'water' ? event.amount : 0;
    case 'steps':
      return event.batteryTypeId === 'movement' ? event.amount : 0;
    case 'walkMinutes': {
      if (event.batteryTypeId !== 'energy') return 0;
      const m = WALK_NOTE_RE.exec(event.note ?? '');
      return m ? parseFloat(m[2]) : 0;
    }
  }
}

// Sum events into per-day totals for one metric: { 'YYYY-MM-DD': total }.
export function dailyTotals(events: IntakeEvent[], metric: RoutineMetric): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const e of events) {
    const amt = metricAmount(e, metric);
    if (amt === 0) continue;
    const day = dateString(new Date(e.timestamp));
    totals[day] = (totals[day] ?? 0) + amt;
  }
  return totals;
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + deltaDays);
  return dateString(d);
}

export function analyzeMetric(
  metric: RoutineMetric,
  totals: Record<string, number>,
  today: string
): RoutineInsight {
  // Values for the previous MAX_LOOKBACK_DAYS days, most recent first.
  const recent: number[] = [];
  for (let i = 1; i <= MAX_LOOKBACK_DAYS; i++) {
    recent.push(totals[shiftDate(today, -i)] ?? 0);
  }

  let streakDays = 0;
  while (streakDays < recent.length && recent[streakDays] > 0) streakDays++;

  const logged = recent.filter((v) => v > 0);
  const med = median(logged);
  const suggested = logged.length > 0 ? roundForMetric(metric, med) : null;

  let isRoutine = false;
  if (streakDays >= MIN_STREAK_DAYS) {
    const streak = recent.slice(0, streakDays);
    const streakMed = median(streak);
    isRoutine = streak.every((v) => Math.abs(v - streakMed) <= streakMed * ROUTINE_TOLERANCE);
  }

  return {
    metric,
    streakDays,
    isRoutine,
    suggested: suggested !== null && suggested > 0 ? suggested : null,
    loggedToday: Math.max(0, totals[today] ?? 0),
  };
}

export function analyzeRoutines(events: IntakeEvent[], today: string): RoutineInsights {
  const out = {} as RoutineInsights;
  for (const metric of ROUTINE_METRICS) {
    out[metric] = analyzeMetric(metric, dailyTotals(events, metric), today);
  }
  return out;
}

export function emptyInsights(): RoutineInsights {
  const out = {} as RoutineInsights;
  for (const metric of ROUTINE_METRICS) {
    out[metric] = { metric, streakDays: 0, isRoutine: false, suggested: null, loggedToday: 0 };
  }
  return out;
}

// Which check-in slot (if any) the given local hour falls in.
export function slotForHour(
  hour: number,
  windows: Record<RoutineSlot, TimeWindow> = DEFAULT_ROUTINE_WINDOWS
): RoutineSlot | null {
  for (const slot of ['morning', 'evening'] as RoutineSlot[]) {
    const w = windows[slot];
    if (hour >= w.startHour && hour < w.endHour) return slot;
  }
  return null;
}

// Auto mode fills a slot's metrics once its window has started (so water /
// steps are not filled at 6am before the day has happened).
export function slotHasStarted(
  slot: RoutineSlot,
  hour: number,
  windows: Record<RoutineSlot, TimeWindow> = DEFAULT_ROUTINE_WINDOWS
): boolean {
  return hour >= windows[slot].startHour;
}

// Metrics auto mode should fill right now: routine detected, nothing logged
// today yet, slot started, and not already auto-filled (or undone) today.
export function metricsToAutoFill(
  insights: RoutineInsights,
  hour: number,
  alreadyFilled: Partial<Record<RoutineMetric, unknown>>,
  windows: Record<RoutineSlot, TimeWindow> = DEFAULT_ROUTINE_WINDOWS
): RoutineMetric[] {
  const out: RoutineMetric[] = [];
  for (const slot of ['morning', 'evening'] as RoutineSlot[]) {
    if (!slotHasStarted(slot, hour, windows)) continue;
    for (const metric of SLOT_METRICS[slot]) {
      const ins = insights[metric];
      if (ins.isRoutine && ins.suggested && ins.loggedToday === 0 && alreadyFilled[metric] === undefined) {
        out.push(metric);
      }
    }
  }
  return out;
}

// ---- Sleep time helpers ("ngủ lúc / dậy lúc" → hours) ----

// Parse "HH:MM" (also accepts "H", "HH", "H:MM", "HHhMM", "HH.MM"). Returns
// minutes since midnight, or null if invalid.
export function parseClockTime(input: string): number | null {
  const m = /^\s*(\d{1,2})(?:\s*[:h.]\s*(\d{1,2}))?\s*$/i.exec(input);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = m[2] !== undefined ? parseInt(m[2], 10) : 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function formatClockTime(minutes: number): string {
  const norm = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Hours slept between bedtime and wake time, wrapping past midnight.
// Rounded to 0.25h. Returns null if either time is invalid or the span is 0.
export function sleepHoursBetween(bedtime: string, wakeTime: string): number | null {
  const bed = parseClockTime(bedtime);
  const wake = parseClockTime(wakeTime);
  if (bed === null || wake === null) return null;
  const span = (wake - bed + 1440) % 1440;
  if (span === 0) return null;
  return roundForMetric('sleep', span / 60);
}

// Default bedtime/wake to pre-fill the morning card: the last times the user
// confirmed, else derived from the suggested sleep hours with a 06:30 wake.
export function defaultSleepTimes(
  last: { bedtime: string | null; wakeTime: string | null },
  suggestedHours: number | null
): { bedtime: string; wakeTime: string } {
  const wakeTime = last.wakeTime ?? '06:30';
  if (last.bedtime) return { bedtime: last.bedtime, wakeTime };
  const wakeMin = parseClockTime(wakeTime) ?? 390;
  const hours = suggestedHours ?? 7.5;
  return { bedtime: formatClockTime(wakeMin - hours * 60), wakeTime };
}
