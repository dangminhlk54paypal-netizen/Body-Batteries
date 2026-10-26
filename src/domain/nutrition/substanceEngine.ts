import type { FoodItem, FoodLogEntry, Nutrition } from '../../types/food';
import { dateString } from '../../lib/dateUtils';
import {
  CAFFEINE_DAILY_LIMIT_MG,
  CAFFEINE_DOSE_WINDOW_MIN,
  CAFFEINE_LATE_MG,
  CAFFEINE_SINGLE_DOSE_MG,
  CAFFEINE_SLEEP_GAP_H,
  CARNITINE_OSL_MG,
  CREATINE_LOADING_MG,
  HABIT_DAYS_THRESHOLD,
  SUBSTANCE_IDS,
  TAURINE_REFERENCE_MG,
  type SubstanceId,
} from '../../lib/substanceLimits';

// Pure active-substance engine (caffeine, taurine, L-carnitine, creatine) —
// the ☕ panel on Home. Like microBatteryEngine it recomputes from the food
// log + a food lookup (getAnyFoodById in the app), so the log itself is the
// diary: nothing extra is stored, and a corrected label (override) flows
// into every past day. No DB/store import here — fully unit-testable.

export type SubstanceEntry = Pick<
  FoodLogEntry,
  'id' | 'foodId' | 'foodNameVi' | 'grams' | 'timestamp' | 'portionUnit' | 'count'
>;

export type FoodLookup = (foodId: string) => FoodItem | undefined;

export type SubstanceTotals = Record<SubstanceId, number>;

function per100gOf(p: Nutrition, id: SubstanceId): number {
  switch (id) {
    case 'caffeine':
      return p.caffeineMg ?? 0;
    case 'taurine':
      return p.taurineMg ?? 0;
    case 'carnitine':
      return p.carnitineMg ?? 0;
    case 'creatine':
      return p.creatineMg ?? 0;
  }
}

function emptyTotals(): SubstanceTotals {
  return { caffeine: 0, taurine: 0, carnitine: 0, creatine: 0 };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// mg of each substance in one logged portion (0 for an unresolvable food).
export function substancesOfEntry(entry: SubstanceEntry, lookup: FoodLookup): SubstanceTotals {
  const totals = emptyTotals();
  const item = lookup(entry.foodId);
  if (!item) return totals;
  const factor = Math.max(0, entry.grams) / 100;
  for (const id of SUBSTANCE_IDS) totals[id] = round1(per100gOf(item.per100g, id) * factor);
  return totals;
}

// One logged item that carried caffeine — a row of the day's diary.
export interface CaffeineIntake {
  entry: SubstanceEntry;
  mg: number;
  late: boolean;
}

// Whether a moment falls in the "too close to bed" part of the day: from
// CAFFEINE_SLEEP_GAP_H before bedtime through the next 12 hours (so a 1 am
// coffee after a missed bedtime still counts as late, a 6 am one does not).
export function isLateForSleep(timestamp: number, bedtimeHour: number): boolean {
  const d = new Date(timestamp);
  const hour = d.getHours() + d.getMinutes() / 60;
  const start = (bedtimeHour - CAFFEINE_SLEEP_GAP_H + 24) % 24;
  return (hour - start + 24) % 24 < 12;
}

// The largest amount taken within any CAFFEINE_DOSE_WINDOW_MIN window — what
// EFSA's single-dose mark is compared against. Intakes must be time-sorted.
export function peakDoseMg(intakes: CaffeineIntake[]): number {
  const windowMs = CAFFEINE_DOSE_WINDOW_MIN * 60_000;
  let peak = 0;
  for (let i = 0; i < intakes.length; i++) {
    let sum = 0;
    for (let j = i; j >= 0 && intakes[i].entry.timestamp - intakes[j].entry.timestamp <= windowMs; j--) {
      sum += intakes[j].mg;
    }
    peak = Math.max(peak, sum);
  }
  return round1(peak);
}

export type SubstanceFlagId =
  | 'caffeineDaily'
  | 'caffeineDose'
  | 'caffeineLate'
  | 'taurineDaily'
  | 'carnitineDaily'
  | 'creatineHigh';

export interface SubstanceFlag {
  id: SubstanceFlagId;
  value: number; // mg
  mark: number; // mg
}

export interface SubstanceDay {
  date: string; // YYYY-MM-DD (calendar day of the log timestamps)
  totals: SubstanceTotals;
  caffeineIntakes: CaffeineIntake[]; // time-sorted
  peakDoseMg: number;
  lateCaffeineMg: number;
  flags: SubstanceFlag[];
}

// Everything the ☕ panel shows for one day's entries.
export function evaluateSubstanceDay(
  date: string,
  entries: SubstanceEntry[],
  lookup: FoodLookup,
  bedtimeHour: number
): SubstanceDay {
  const totals = emptyTotals();
  const caffeineIntakes: CaffeineIntake[] = [];
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  for (const entry of sorted) {
    const amounts = substancesOfEntry(entry, lookup);
    for (const id of SUBSTANCE_IDS) totals[id] = round1(totals[id] + amounts[id]);
    if (amounts.caffeine > 0) {
      caffeineIntakes.push({
        entry,
        mg: amounts.caffeine,
        late: isLateForSleep(entry.timestamp, bedtimeHour),
      });
    }
  }
  const peak = peakDoseMg(caffeineIntakes);
  const lateCaffeineMg = round1(caffeineIntakes.filter((i) => i.late).reduce((s, i) => s + i.mg, 0));

  const flags: SubstanceFlag[] = [];
  const check = (id: SubstanceFlagId, value: number, mark: number) => {
    if (value > mark) flags.push({ id, value, mark });
  };
  check('caffeineDaily', totals.caffeine, CAFFEINE_DAILY_LIMIT_MG);
  check('caffeineDose', peak, CAFFEINE_SINGLE_DOSE_MG);
  // ≥, not >: EFSA's "100 mg close to bedtime" is the amount itself.
  if (lateCaffeineMg >= CAFFEINE_LATE_MG) {
    flags.push({ id: 'caffeineLate', value: lateCaffeineMg, mark: CAFFEINE_LATE_MG });
  }
  check('taurineDaily', totals.taurine, TAURINE_REFERENCE_MG);
  check('carnitineDaily', totals.carnitine, CARNITINE_OSL_MG);
  check('creatineHigh', totals.creatine, CREATINE_LOADING_MG);

  return { date, totals, caffeineIntakes, peakDoseMg: peak, lateCaffeineMg, flags };
}

// Groups a multi-day log by calendar day and evaluates each requested date
// (oldest first). A date with no entries still yields an empty day, so a
// week strip always has its 7 columns.
export function evaluateSubstanceDays(
  dates: string[],
  entries: SubstanceEntry[],
  lookup: FoodLookup,
  bedtimeHour: number
): SubstanceDay[] {
  const byDay = new Map<string, SubstanceEntry[]>();
  for (const e of entries) {
    const day = dateString(new Date(e.timestamp));
    const list = byDay.get(day);
    if (list) list.push(e);
    else byDay.set(day, [e]);
  }
  return dates.map((d) => evaluateSubstanceDay(d, byDay.get(d) ?? [], lookup, bedtimeHour));
}

export type SubstanceHabitId = 'caffeineDailyHabit' | 'caffeineLateHabit';

export interface SubstanceHabits {
  caffeineDays: number; // days with any caffeine
  averageCaffeineMg: number; // over the days that had caffeine
  daysOverDaily: number;
  lateDays: number;
  habits: SubstanceHabitId[];
}

// The long-term view: what the last days add up to. A single heavy day is
// already flagged on its own; a habit note only appears once the same thing
// repeats on HABIT_DAYS_THRESHOLD days of the window.
export function summarizeSubstanceHabits(days: SubstanceDay[]): SubstanceHabits {
  const withCaffeine = days.filter((d) => d.totals.caffeine > 0);
  const daysOverDaily = days.filter((d) => d.flags.some((f) => f.id === 'caffeineDaily')).length;
  const lateDays = days.filter((d) => d.flags.some((f) => f.id === 'caffeineLate')).length;
  const total = withCaffeine.reduce((s, d) => s + d.totals.caffeine, 0);
  const habits: SubstanceHabitId[] = [];
  if (daysOverDaily >= HABIT_DAYS_THRESHOLD) habits.push('caffeineDailyHabit');
  if (lateDays >= HABIT_DAYS_THRESHOLD) habits.push('caffeineLateHabit');
  return {
    caffeineDays: withCaffeine.length,
    averageCaffeineMg: withCaffeine.length > 0 ? Math.round(total / withCaffeine.length) : 0,
    daysOverDaily,
    lateDays,
    habits,
  };
}

// The ISSN 3–6 mg/kg performance range expressed for this body weight.
export function caffeinePerformanceRangeMg(
  weightKg: number,
  perKg: { min: number; max: number }
): { min: number; max: number } {
  const w = Math.max(0, weightKg);
  return { min: Math.round(w * perKg.min), max: Math.round(w * perKg.max) };
}
