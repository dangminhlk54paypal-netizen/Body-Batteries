import type { DailyBatteryTotals } from './dailyBatteryTotals';

// Home "keyword" chips: at most three short, actionable states under the
// sub-battery title ("Thiếu 30g đạm", "Uống thêm 2 ly", "Ngủ đủ"). Pure —
// the screen passes today's totals, each battery's daily target and the
// current hour, and translates the result.
//
// Paced by the time of day so the app doesn't scold at breakfast: on pace =
// no chip; behind the pace = 'mid' (amber), clearly behind = 'low' (soft
// coral), and the amount is only what it takes to catch up with the pace
// right now (the whole remainder only late in the evening). Reaching the
// target = 'good'.

export type KeywordBattery = 'protein' | 'water' | 'sleep' | 'movement';
export type KeywordTone = 'good' | 'mid' | 'low';

export interface HomeKeyword {
  battery: KeywordBattery;
  tone: KeywordTone;
  // 'short' = behind (amount = what's needed to catch up with the pace now,
  // in the battery's unit, or glasses for water); 'done' = target reached.
  kind: 'short' | 'done';
  amount: number;
}

export type KeywordTargets = Partial<Record<KeywordBattery, number>>;

export const MAX_HOME_KEYWORDS = 3;
export const WATER_GLASS_ML = 250;
// Waking day used for pacing: nothing is expected before 06:00, the full
// target by 22:00.
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;
// How far behind the pace counts as clearly behind ('low').
const LOW_GAP = 0.25;

const ORDER: KeywordBattery[] = ['protein', 'water', 'sleep', 'movement'];
const TONE_RANK: Record<KeywordTone, number> = { low: 0, mid: 1, good: 2 };

export function expectedShareByHour(hour: number): number {
  const share = (hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR);
  return Math.min(1, Math.max(0, share));
}

function loggedAmount(battery: KeywordBattery, totals: DailyBatteryTotals): number {
  switch (battery) {
    case 'protein':
      return totals.protein;
    case 'water':
      return totals.water;
    case 'sleep':
      return totals.sleep;
    case 'movement':
      return totals.movementSteps;
  }
}

function missingAmount(battery: KeywordBattery, missing: number): number {
  if (battery === 'water') return Math.max(1, Math.ceil(missing / WATER_GLASS_ML));
  if (battery === 'sleep') return Math.max(0.5, Math.round(missing * 2) / 2);
  if (battery === 'movement') return Math.round(missing / 100) * 100;
  return Math.round(missing);
}

function keywordFor(
  battery: KeywordBattery,
  target: number,
  totals: DailyBatteryTotals,
  hour: number
): HomeKeyword | null {
  if (!(target > 0)) return null;
  const logged = loggedAmount(battery, totals);
  if (logged >= target) return { battery, tone: 'good', kind: 'done', amount: 0 };
  // Sleep is logged once for last night, so it isn't paced through the day.
  // Nothing logged yet = no chip (a missing log isn't a short night).
  if (battery === 'sleep') {
    if (logged <= 0) return null;
    const tone: KeywordTone = logged / target < 1 - LOW_GAP ? 'low' : 'mid';
    return { battery, tone, kind: 'short', amount: missingAmount(battery, target - logged) };
  }
  // Steps come from a sync the app may not have (e.g. Expo Go): 0 steps means
  // "no data yet", not "sat still all day".
  if (battery === 'movement' && logged <= 0) return null;
  const expected = expectedShareByHour(hour);
  const behind = expected * target - logged;
  if (behind <= 0) return null;
  const tone: KeywordTone = logged / target < expected - LOW_GAP ? 'low' : 'mid';
  return { battery, tone, kind: 'short', amount: missingAmount(battery, behind) };
}

export function pickHomeKeywords(
  totals: DailyBatteryTotals,
  targets: KeywordTargets,
  hour: number,
  max: number = MAX_HOME_KEYWORDS
): HomeKeyword[] {
  const all = ORDER.map((b) => keywordFor(b, targets[b] ?? 0, totals, hour)).filter(
    (k): k is HomeKeyword => k != null
  );
  // Most in need first; ties keep the fixed battery order above (stable sort).
  return [...all].sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]).slice(0, max);
}
