import type { LiftingExercise, LiftingSet, UserProfile } from '../../types/energy';
import { LIFTING_EXERCISES } from '../../types/energy';
import type {
  BlockDayPlan,
  BlockWeekPlan,
  GeneratedBlockPlan,
  OneRepMaxInput,
  ResolvedDayPlan,
  ResolvedVariationPlan,
  TrainingBlockConfig,
  TrainingFocus,
} from '../../types/powerliftingBlock';
import { findVariation } from '../../lib/powerliftingVariations';
import { liftingSessionKcal, estimateLiftingMinutes } from './liftingEngine';
import { dailyCalorieTarget } from './weightGoal';
import { BARBELL_WEIGHT_KG } from '../../lib/metabolicConstants';
import { addDaysToDateString, mondayFirstRank } from '../../lib/dateUtils';

// Pure functions for the S-PL Block Builder's programming engine. Every
// constant here is grounded in docs/08-powerlifting-engine.md — read that
// file before changing a number; it names the source for each one.
//
// This engine NEVER computes kcal itself — it resolves concrete LiftingSet[]
// per day and hands them to the EXISTING liftingSessionKcal() (liftingEngine.ts,
// the physics-based set×rep×weight model). It also never invents a second
// weight-loss pace formula — Deficit Mode's weekly target reuses
// dailyCalorieTarget() (weightGoal.ts) as-is.

// ---- 1. Beginner-safe 1RM estimation --------------------------------------

// Low end of the "novice" %bodyweight strength-standard band per lift
// (docs/08 §4 [16]), further scaled by BEGINNER_SAFETY_FACTOR since these
// are population medians, not a verified personal max.
const BEGINNER_BW_MULTIPLIER: Record<LiftingExercise, number> = {
  squat: 1.0,
  bench_press: 0.75,
  deadlift: 1.25,
};
const BEGINNER_SAFETY_FACTOR = 0.85;

// A safe STARTING point for someone with no reliable 1RM — explicitly NOT a
// real 1RM (docs/08 §4). Callers must surface this distinction to the user.
export function estimateBeginnerOneRepMax(exercise: LiftingExercise, bodyWeightKg: number): number {
  if (bodyWeightKg <= 0) return 0;
  return (
    Math.round(bodyWeightKg * BEGINNER_BW_MULTIPLIER[exercise] * BEGINNER_SAFETY_FACTOR * 10) / 10
  );
}

export interface ResolvedOneRepMax {
  value: number;
  isEstimated: boolean;
}

// Fills in any missing/zero 1RM with the beginner-safe estimate, flagging
// which lifts were estimated so the wizard/appendix can surface the caveat
// ("số ước lượng — nên test lại 1RM thật sau 2-3 tuần").
export function resolveOneRepMax(
  input: OneRepMaxInput,
  bodyWeightKg: number
): Record<LiftingExercise, ResolvedOneRepMax> {
  const out = {} as Record<LiftingExercise, ResolvedOneRepMax>;
  for (const exercise of LIFTING_EXERCISES) {
    const declared = input[exercise];
    if (declared != null && declared > 0) {
      out[exercise] = { value: declared, isEstimated: false };
    } else {
      out[exercise] = {
        value: estimateBeginnerOneRepMax(exercise, bodyWeightKg),
        isEstimated: true,
      };
    }
  }
  return out;
}

// ---- 2. Focus → week/day curve --------------------------------------------

interface CurvePoint {
  pct: number; // %1RM, 0-100
  sets: number;
  reps: number;
}

// Three anchors (early/mid/late block position) per focus, midpoints of the
// %1RM×set×rep ranges in docs/08-powerlifting-engine.md §2.1's table.
const FOCUS_WEEK_CURVES: Record<'volume' | 'intensity' | 'peaking', [CurvePoint, CurvePoint, CurvePoint]> = {
  volume: [
    { pct: 68, sets: 5, reps: 9 },
    { pct: 73, sets: 4, reps: 7 },
    { pct: 78, sets: 4, reps: 5 },
  ],
  intensity: [
    { pct: 78, sets: 4, reps: 5 },
    { pct: 83, sets: 4, reps: 4 },
    { pct: 88, sets: 3, reps: 3 },
  ],
  peaking: [
    { pct: 83, sets: 3, reps: 3 },
    { pct: 88, sets: 3, reps: 2 },
    { pct: 94, sets: 2, reps: 1 },
  ],
};

// 'normal' (DUP-style) rotates by DAY ROLE within a week rather than by week
// position — docs/08 §2.1's "Normal" row. Index 0 = heaviest day of the
// week; it alone nudges upward as the block progresses (see NORMAL_HEAVY_DAY_NUDGE_PCT).
const NORMAL_DAY_ROLE_CURVE: [CurvePoint, CurvePoint, CurvePoint] = [
  { pct: 83, sets: 4, reps: 4 }, // heavy day
  { pct: 73, sets: 4, reps: 7 }, // moderate day
  { pct: 65, sets: 4, reps: 9 }, // light/technique day
];
const NORMAL_HEAVY_DAY_NUDGE_PCT = 5; // heaviest day climbs up to +5pts by the block's last week

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Piecewise-linear across the 3 anchors: t in [0,0.5] interpolates
// anchor0→anchor1, [0.5,1] interpolates anchor1→anchor2. t=0.5 lands exactly
// on the middle anchor.
function curveAt(points: [CurvePoint, CurvePoint, CurvePoint], t: number): CurvePoint {
  const clamped = Math.max(0, Math.min(1, t));
  const [p0, p1, p2] = points;
  const [from, to, localT] = clamped <= 0.5 ? [p0, p1, clamped / 0.5] : [p1, p2, (clamped - 0.5) / 0.5];
  return {
    pct: Math.round(lerp(from.pct, to.pct, localT)),
    sets: Math.round(lerp(from.sets, to.sets, localT)),
    reps: Math.round(lerp(from.reps, to.reps, localT)),
  };
}

// Normalized 0..1 position of `weekIndex` (0-based) within the progressive
// portion of the block. A single-week block is treated as fully "late".
function weekPosition(weekIndex: number, progressiveWeeks: number): number {
  if (progressiveWeeks <= 1) return 1;
  return weekIndex / (progressiveWeeks - 1);
}

// The %1RM×set×rep target for one training day, given the block's chosen
// focus, how far into the block this week is, and which day-of-week-in-order
// (0-based, by schedule order) this is — only 'normal' uses the day index.
export function focusCurvePoint(
  focus: TrainingFocus,
  weekIndex: number,
  progressiveWeeks: number,
  dayIndexInWeek: number
): CurvePoint {
  const t = weekPosition(weekIndex, progressiveWeeks);
  if (focus === 'normal') {
    const roleIndex = dayIndexInWeek % 3;
    const role = NORMAL_DAY_ROLE_CURVE[roleIndex];
    const nudge = roleIndex === 0 ? Math.round(NORMAL_HEAVY_DAY_NUDGE_PCT * t) : 0;
    return { ...role, pct: role.pct + nudge };
  }
  return curveAt(FOCUS_WEEK_CURVES[focus], t);
}

// Deload override (docs/08 §2.1): ~10-point %1RM drop, ~50% fewer sets vs
// the curve point it's derived from. Kept as a standalone numeric transform
// (not tied to a resolved week) so it can be unit-tested in isolation.
export function deloadCurvePoint(basePoint: CurvePoint): CurvePoint {
  return {
    pct: Math.max(0, basePoint.pct - 10),
    sets: Math.max(1, Math.round(basePoint.sets * 0.5)),
    reps: basePoint.reps,
  };
}

// ---- 3. Resolving a day into concrete sets --------------------------------

function roundToPlate(weightKg: number): number {
  return Math.round(weightKg / 2.5) * 2.5;
}

function resolveVariationSets(
  variationId: string,
  exercise: LiftingExercise,
  curvePoint: CurvePoint,
  oneRepMaxByExercise: Record<LiftingExercise, ResolvedOneRepMax>
): LiftingSet[] {
  const loadFactor = findVariation(variationId)?.loadFactor ?? 1;
  const oneRepMax = oneRepMaxByExercise[exercise].value;
  const rawWeight = oneRepMax * (curvePoint.pct / 100) * loadFactor;
  const weightKg = Math.max(roundToPlate(rawWeight), oneRepMax > 0 ? BARBELL_WEIGHT_KG : 0);
  return Array.from({ length: curvePoint.sets }, () => ({
    kind: 'working' as const,
    weightKg,
    reps: curvePoint.reps,
  }));
}

function resolveDayWithPoint(
  day: BlockDayPlan,
  curvePoint: CurvePoint,
  oneRepMaxByExercise: Record<LiftingExercise, ResolvedOneRepMax>,
  bodyWeightKg: number,
  heightCm: number
): ResolvedDayPlan {
  const variations: ResolvedVariationPlan[] = day.variations.map((variation) => {
    const sets = resolveVariationSets(
      variation.variationId,
      variation.exercise,
      curvePoint,
      oneRepMaxByExercise
    );
    const estimatedKcal = liftingSessionKcal(variation.exercise, sets, bodyWeightKg, heightCm);
    return { variation, pct1rm: curvePoint.pct, sets, estimatedKcal };
  });
  const totalKcal = variations.reduce((sum, v) => sum + v.estimatedKcal, 0);
  const totalMinutes = estimateLiftingMinutes(variations.flatMap((v) => v.sets));
  return { dayOfWeek: day.dayOfWeek, variations, accessories: day.accessories, totalKcal, totalMinutes };
}

// ---- 4. Deficit Mode -------------------------------------------------------

// docs/08 §5.3: cut accessory VOLUME (sets) 15-20%, leave main/secondary
// %1RM untouched — accessories contribute little to SBD performance and
// carry most of the "recovery cost", the sensible place to cut when energy
// for recovery is limited by the deficit.
export function applyDeficitMode(week: BlockWeekPlan, cutPct = 0.825): BlockWeekPlan {
  const days = week.days.map((day) => ({
    ...day,
    accessories: day.accessories.map((a) => ({
      ...a,
      sets: Math.max(1, Math.round(a.sets * cutPct)),
    })),
  }));
  return { ...week, days };
}

// ---- 5. Full block generation ----------------------------------------------

export function generateBlockPlan(config: TrainingBlockConfig, profile: UserProfile): GeneratedBlockPlan {
  const oneRepMaxByExercise = resolveOneRepMax(config.oneRepMax, config.bodyWeightKg);
  // Monday-first: JS Date's raw dayOfWeek (0=Sun) would otherwise sort
  // Sunday before Monday — mondayFirstRank remaps 0=Mon..6=Sun.
  const sortedSchedule = [...config.schedule].sort(
    (a, b) => mondayFirstRank(a.dayOfWeek) - mondayFirstRank(b.dayOfWeek)
  );
  const weeklyDeficitTargetKcal = config.deficitModeEnabled
    ? dailyCalorieTarget(profile).appliedDeltaKcal * 7
    : null;

  const weeks: BlockWeekPlan[] = [];

  for (let weekIndex = 0; weekIndex < config.progressiveWeeks; weekIndex++) {
    const days = sortedSchedule.map((day, dayIndexInWeek) => {
      const curvePoint = focusCurvePoint(config.focus, weekIndex, config.progressiveWeeks, dayIndexInWeek);
      return resolveDayWithPoint(day, curvePoint, oneRepMaxByExercise, config.bodyWeightKg, profile.heightCm);
    });
    const startDate = addDaysToDateString(config.weekStartDate, weekIndex * 7);
    let week: BlockWeekPlan = {
      weekNumber: weekIndex + 1,
      isDeload: false,
      days,
      totalKcal: days.reduce((sum, d) => sum + d.totalKcal, 0),
      weeklyDeficitTargetKcal,
      startDate,
      endDate: addDaysToDateString(startDate, 6),
    };
    if (config.deficitModeEnabled) week = applyDeficitMode(week);
    weeks.push(week);
  }

  if (config.hasDeload) {
    const days = sortedSchedule.map((day, dayIndexInWeek) => {
      const basePoint = focusCurvePoint(
        config.focus,
        config.progressiveWeeks - 1,
        config.progressiveWeeks,
        dayIndexInWeek
      );
      const deloadPoint = deloadCurvePoint(basePoint);
      return resolveDayWithPoint(day, deloadPoint, oneRepMaxByExercise, config.bodyWeightKg, profile.heightCm);
    });
    const startDate = addDaysToDateString(config.weekStartDate, config.progressiveWeeks * 7);
    let deloadWeek: BlockWeekPlan = {
      weekNumber: config.progressiveWeeks + 1,
      isDeload: true,
      days,
      totalKcal: days.reduce((sum, d) => sum + d.totalKcal, 0),
      weeklyDeficitTargetKcal,
      startDate,
      endDate: addDaysToDateString(startDate, 6),
    };
    if (config.deficitModeEnabled) deloadWeek = applyDeficitMode(deloadWeek);
    weeks.push(deloadWeek);
  }

  return { config, weeks };
}
