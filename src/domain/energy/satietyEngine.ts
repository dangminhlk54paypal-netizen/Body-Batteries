import type { UserProfile } from '../../types/energy';
import { passiveDailyBurn } from './metabolismEngine';
import {
  CIRCADIAN_WINDOW,
  SLEEP_BURN_MULTIPLIER,
  FULLNESS_CAPACITY_KCAL,
  SATIETY_FLOOR_PCT,
} from '../../lib/metabolicConstants';

// Pure functions modelling the "satiety" (fullness/hunger) battery — a
// short-term kcal reserve that eating tops up and time drains, shaped by a
// fixed awake/asleep circadian window. See
// .ai/parallel-reports/S-O-satiety-battery-spec.md. NOT medical advice.

const HOUR_MS = 60 * 60 * 1000;

// Awake/asleep hourly burn rates (kcal/hour) such that a full, uninterrupted
// 24h cycle burns exactly passiveDailyBurn(profile) — the same total as
// today's "energy" battery capacity, just reshaped across the day instead of
// spread evenly. Solve R from:
//   dailyBurn = R * awakeHours + (R * SLEEP_BURN_MULTIPLIER) * sleepHours
function circadianHourlyRates(profile: UserProfile): { awake: number; asleep: number } {
  const awakeHours = CIRCADIAN_WINDOW.sleepHour - CIRCADIAN_WINDOW.wakeHour;
  const sleepHours = 24 - awakeHours;
  const dailyBurn = passiveDailyBurn(profile);
  const awake = dailyBurn / (awakeHours + SLEEP_BURN_MULTIPLIER * sleepHours);
  return { awake, asleep: awake * SLEEP_BURN_MULTIPLIER };
}

function isAwakeAt(localHour: number): boolean {
  return localHour >= CIRCADIAN_WINDOW.wakeHour && localHour < CIRCADIAN_WINDOW.sleepHour;
}

// Start of the next local clock hour strictly after `ms`.
function nextHourBoundaryMs(ms: number): number {
  const d = new Date(ms);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.getTime();
}

// Unrounded kcal burned between two timestamps, following the awake/asleep
// rate for whichever part of the day each portion of the interval falls in.
// Kept unrounded so replaySatietyReserve can chain many short segments without
// each one rounding to 0-1 kcal (see syncSatietyReserve in energyStore for the
// same reasoning). Integrating this over any continuous 24h span always
// equals passiveDailyBurn(profile), regardless of the starting hour (the
// awake/asleep rates are a fixed partition of every 24h day, so a full day
// always contributes exactly awakeHours + sleepHours of burn, no matter where
// the window starts).
export function circadianBurnKcalExact(profile: UserProfile, fromMs: number, toMs: number): number {
  if (toMs <= fromMs) return 0;
  const rates = circadianHourlyRates(profile);
  let cursor = fromMs;
  let totalKcal = 0;
  while (cursor < toMs) {
    const segmentEnd = Math.min(nextHourBoundaryMs(cursor), toMs);
    const elapsedHours = (segmentEnd - cursor) / HOUR_MS;
    const rate = isAwakeAt(new Date(cursor).getHours()) ? rates.awake : rates.asleep;
    totalKcal += elapsedHours * rate;
    cursor = segmentEnd;
  }
  return totalKcal;
}

// Rounded to whole kcal — the value the rest of the app displays/persists.
export function circadianBurnKcal(profile: UserProfile, fromMs: number, toMs: number): number {
  return Math.round(circadianBurnKcalExact(profile, fromMs, toMs));
}

// Apply the passage of time to the reserve (floors at 0 — it never goes negative).
export function applyCircadianDrain(
  reserveKcal: number,
  profile: UserProfile,
  fromMs: number,
  toMs: number
): number {
  return Math.max(0, reserveKcal - circadianBurnKcal(profile, fromMs, toMs));
}

// Eating tops up the reserve, capped at FULLNESS_CAPACITY_KCAL.
export function eatIntoReserve(reserveKcal: number, kcalEaten: number): number {
  if (kcalEaten <= 0) return reserveKcal;
  return Math.min(FULLNESS_CAPACITY_KCAL, reserveKcal + kcalEaten);
}

// A logged workout drains the reserve directly (training makes you hungrier).
export function drainFromWorkout(reserveKcal: number, workoutKcalBurned: number): number {
  if (workoutKcalBurned <= 0) return reserveKcal;
  return Math.max(0, reserveKcal - workoutKcalBurned);
}

// Map the reserve to a 0-100 gauge with a floor — it never reads as fully
// empty, since the body always keeps some reserve (see SATIETY_FLOOR_PCT).
export function satietyPercentage(reserveKcal: number): number {
  const clamped = Math.max(0, Math.min(FULLNESS_CAPACITY_KCAL, reserveKcal));
  const pct = SATIETY_FLOOR_PCT + (100 - SATIETY_FLOOR_PCT) * (clamped / FULLNESS_CAPACITY_KCAL);
  return Math.max(0, Math.min(100, pct));
}

export interface SatietyEvent {
  atMs: number;
  kind: 'eat' | 'workout';
  kcal: number; // always positive
}

// Replays timestamped events in chronological order from a known start state:
// drain (circadian, unrounded) between events, eat = +kcal capped at
// FULLNESS_CAPACITY_KCAL, workout = -kcal floored at 0. Events outside
// [startMs, nowMs] are ignored. Input order does not matter (sorted inside,
// stable for equal timestamps). Rounded once, at the end.
//
// This is the single source of truth for the satiety reserve: an event acts
// at the moment it HAPPENED (meal time / workout end), not when it was logged,
// so logging late and logging on time give the same result.
export function replaySatietyReserve(
  profile: UserProfile,
  startReserveKcal: number,
  startMs: number,
  events: readonly SatietyEvent[],
  nowMs: number
): number {
  const ordered = events
    .filter((e) => e.kcal > 0 && e.atMs >= startMs && e.atMs <= nowMs)
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.atMs - b.e.atMs || a.i - b.i)
    .map(({ e }) => e);

  let reserve = Math.max(0, Math.min(FULLNESS_CAPACITY_KCAL, startReserveKcal));
  let cursor = startMs;
  for (const ev of ordered) {
    reserve = Math.max(0, reserve - circadianBurnKcalExact(profile, cursor, ev.atMs));
    reserve =
      ev.kind === 'eat'
        ? eatIntoReserve(reserve, ev.kcal)
        : drainFromWorkout(reserve, ev.kcal);
    cursor = ev.atMs;
  }
  reserve = Math.max(0, reserve - circadianBurnKcalExact(profile, cursor, nowMs));
  return Math.round(reserve);
}
