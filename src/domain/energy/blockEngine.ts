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
  VariationReference,
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

// ---- 2. Focus → week/day prescription -------------------------------------
//
// A day's prescription is SETS × REPS × TARGET RPE (how hard the LAST set
// should feel), and the load is DERIVED from it — not a fixed %1RM looked up
// from a table. The old fixed table (e.g. volume mid-block "73% × 4 × 7")
// ignored that fatigue builds set after set, and it was applied unchanged to
// every movement of the day; users found it physically unrealistic in a
// heavy session (feedback 2026-09-24). See docs/08 §2.1 for the model.
//
//   RIR on the last set   = 10 − target RPE                (Zourdos 2016 RIR-RPE scale)
//   fatigue RIR           = (sets − 1) × per-set allowance (each set leaves you a
//                           little weaker; higher-rep sets cost more)
//   reps to failure (R)   = reps + RIR + fatigue RIR       (what the FIRST set is loaded for)
//   %1RM                  = 1 / (1 + R/30)                 (inverse of the app's own Epley e1RM,
//                                                           liftingEngine.estimatedOneRepMax)

export interface CurvePoint {
  sets: number;
  reps: number;
  rpe: number; // target RPE of the LAST set, 5-10
  pct: number; // %1RM (0-100) derived from the three above (or set directly for a deload)
}

// `extraRir` = reps in reserve added on top of RPE + per-set fatigue — used for
// a secondary movement, which starts already tired from the main one.
type Prescription = Omit<CurvePoint, 'pct'> & { extraRir?: number };

// Reps-in-reserve each additional set "costs": 0.15 per rep in the set, kept
// between 0.5 (triples and heavier) and 1.5 (sets of 10+) — higher-rep sets
// leave more fatigue behind. A coaching heuristic, not an RCT constant —
// docs/08 §2.1 says so explicitly.
function fatigueRirPerSet(reps: number): number {
  return Math.min(1.5, Math.max(0.5, reps * 0.15));
}

export function fatigueRir(sets: number, reps: number): number {
  return Math.round(Math.max(0, sets - 1) * fatigueRirPerSet(reps) * 10) / 10;
}

// %1RM a lifter can do for `repsToFailure` reps to failure, per the Epley
// formula the rest of the app uses for e1RM. One rep (or less) is 100%.
export function pctForRepsToFailure(repsToFailure: number): number {
  if (repsToFailure <= 1) return 100;
  return 100 / (1 + repsToFailure / 30);
}

export function repsToFailureFor(p: Prescription): number {
  return Math.round((p.reps + (10 - p.rpe) + fatigueRir(p.sets, p.reps) + (p.extraRir ?? 0)) * 10) / 10;
}

// The load (%1RM, whole number) that makes `sets × reps` land on the target
// RPE by the last set.
export function loadPct(p: Prescription): number {
  return Math.round(pctForRepsToFailure(repsToFailureFor(p)));
}

// The inverse, for display only: what RPE the LAST set lands on at `pct`.
// Used for deload weeks, whose load is set directly.
export function rpeForLoad(pct: number, sets: number, reps: number): number {
  const repsToFailure = pct >= 100 ? 1 : 30 * (100 / pct - 1);
  const rir = repsToFailure - reps - fatigueRir(sets, reps);
  // Anything easier than RPE 5 reads as "light" — no finer scale is meaningful.
  return Math.round(Math.min(10, Math.max(5, 10 - rir)) * 2) / 2;
}

function withLoad(p: Prescription): CurvePoint {
  return { sets: p.sets, reps: p.reps, rpe: p.rpe, pct: loadPct(p) };
}

// Three anchors (early / mid / late block) per focus. VOLUME is hypertrophy +
// muscular endurance: moderate loads, sets ADDED week to week, last set never
// harder than RPE 7.5 (≈60-70% 1RM). INTENSITY and PEAKING climb in load as
// reps drop. The loads these produce stay inside docs/08 §2.1's %1RM bands.
const FOCUS_WEEK_PRESCRIPTIONS: Record<'volume' | 'intensity' | 'peaking', [Prescription, Prescription, Prescription]> = {
  volume: [
    { sets: 4, reps: 10, rpe: 6.5 }, // ≈ 62%
    { sets: 5, reps: 10, rpe: 7 }, // ≈ 61% — one more set, a bit closer to failure
    { sets: 6, reps: 8, rpe: 7.5 }, // ≈ 65%
  ],
  intensity: [
    { sets: 4, reps: 5, rpe: 7.5 }, // ≈ 75%
    { sets: 4, reps: 4, rpe: 8 }, // ≈ 79%
    { sets: 3, reps: 3, rpe: 8.5 }, // ≈ 85%
  ],
  peaking: [
    { sets: 3, reps: 3, rpe: 8 }, // ≈ 83%
    { sets: 3, reps: 2, rpe: 8.5 }, // ≈ 87%
    { sets: 2, reps: 1, rpe: 9 }, // ≈ 93%
  ],
};

// 'normal' (DUP-style) rotates by DAY ROLE within a week rather than by week
// position — docs/08 §2.1's "Normal" row. Index 0 = heaviest day of the week;
// it alone gets harder as the block progresses (see NORMAL_HEAVY_DAY_RPE_NUDGE).
const NORMAL_DAY_ROLE_PRESCRIPTIONS: [Prescription, Prescription, Prescription] = [
  { sets: 4, reps: 4, rpe: 8 }, // heavy day ≈ 79%
  { sets: 4, reps: 7, rpe: 6.5 }, // moderate day ≈ 69%
  { sets: 4, reps: 8, rpe: 6 }, // light / technique day ≈ 66%
];
const NORMAL_HEAVY_DAY_RPE_NUDGE = 1; // heavy day climbs up to +1 RPE by the block's last week

// A SECONDARY movement (the lighter variation done after the main one, e.g.
// paused squat after deadlift) is not a second copy of the main work: one set
// fewer (minimum 2), one RPE easier, and loaded as if 1.5 reps were already
// gone — it is done tired. The variation's own loadFactor comes on top.
const SECONDARY_SET_REDUCTION = 1;
const SECONDARY_MIN_SETS = 2;
const SECONDARY_RPE_REDUCTION = 1;
export const SECONDARY_PRE_FATIGUE_RIR = 1.5;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Piecewise-linear across the 3 anchors: t in [0,0.5] interpolates
// anchor0→anchor1, [0.5,1] interpolates anchor1→anchor2. t=0.5 lands exactly
// on the middle anchor. RPE snaps to half points.
function prescriptionAt(points: [Prescription, Prescription, Prescription], t: number): Prescription {
  const clamped = Math.max(0, Math.min(1, t));
  const [p0, p1, p2] = points;
  const [from, to, localT] = clamped <= 0.5 ? [p0, p1, clamped / 0.5] : [p1, p2, (clamped - 0.5) / 0.5];
  return {
    sets: Math.round(lerp(from.sets, to.sets, localT)),
    reps: Math.round(lerp(from.reps, to.reps, localT)),
    rpe: Math.round(lerp(from.rpe, to.rpe, localT) * 2) / 2,
  };
}

// Normalized 0..1 position of `weekIndex` (0-based) within the progressive
// portion of the block. A single-week block is treated as fully "late".
function weekPosition(weekIndex: number, progressiveWeeks: number): number {
  if (progressiveWeeks <= 1) return 1;
  return weekIndex / (progressiveWeeks - 1);
}

// The MAIN movement's prescription for one training day, given the block's
// focus, how far into the block this week is, and which day-in-order
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
    const role = NORMAL_DAY_ROLE_PRESCRIPTIONS[roleIndex];
    const nudge = roleIndex === 0 ? Math.round(NORMAL_HEAVY_DAY_RPE_NUDGE * t * 2) / 2 : 0;
    return withLoad({ ...role, rpe: role.rpe + nudge });
  }
  return withLoad(prescriptionAt(FOCUS_WEEK_PRESCRIPTIONS[focus], t));
}

// The same day's prescription for a SECONDARY movement.
export function secondaryPrescription(main: CurvePoint): Prescription {
  return {
    sets: Math.max(SECONDARY_MIN_SETS, main.sets - SECONDARY_SET_REDUCTION),
    reps: main.reps,
    rpe: Math.max(5, main.rpe - SECONDARY_RPE_REDUCTION),
    extraRir: SECONDARY_PRE_FATIGUE_RIR,
  };
}

export function secondaryCurvePoint(main: CurvePoint): CurvePoint {
  return withLoad(secondaryPrescription(main));
}

// Deload override (docs/08 §2.1): ~10-point %1RM drop, ~50% fewer sets vs the
// point it's derived from. The RPE is read back from the new load (display only).
export function deloadCurvePoint(basePoint: CurvePoint): CurvePoint {
  const sets = Math.max(1, Math.round(basePoint.sets * 0.5));
  const pct = Math.max(0, basePoint.pct - 10);
  return { sets, reps: basePoint.reps, pct, rpe: pct > 0 ? rpeForLoad(pct, sets, basePoint.reps) : 1 };
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
  mainPoint: CurvePoint,
  method: VariationReference['method'],
  oneRepMaxByExercise: Record<LiftingExercise, ResolvedOneRepMax>,
  bodyWeightKg: number,
  heightCm: number
): ResolvedDayPlan {
  const variations: ResolvedVariationPlan[] = day.variations.map((variation) => {
    // A deload keeps every movement on the (already light) deload point.
    const isSecondary = variation.role === 'secondary' && method === 'rpe';
    const point = isSecondary ? secondaryCurvePoint(mainPoint) : mainPoint;
    const sets = resolveVariationSets(variation.variationId, variation.exercise, point, oneRepMaxByExercise);
    const estimatedKcal = liftingSessionKcal(variation.exercise, sets, bodyWeightKg, heightCm);
    const reference: VariationReference = {
      sets,
      pct1rm: point.pct,
      estimatedKcal,
      method,
      targetRpe: point.rpe,
      fatigueRir: fatigueRir(point.sets, point.reps),
      repsToFailure:
        method === 'rpe' ? repsToFailureFor(isSecondary ? secondaryPrescription(mainPoint) : point) : 0,
      extraRir: isSecondary ? SECONDARY_PRE_FATIGUE_RIR : 0,
      oneRepMaxKg: oneRepMaxByExercise[variation.exercise].value,
      loadFactor: findVariation(variation.variationId)?.loadFactor ?? 1,
    };
    return { variation, pct1rm: point.pct, sets, estimatedKcal, reference };
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
      return resolveDayWithPoint(day, curvePoint, 'rpe', oneRepMaxByExercise, config.bodyWeightKg, profile.heightCm);
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
      return resolveDayWithPoint(day, deloadPoint, 'deload', oneRepMaxByExercise, config.bodyWeightKg, profile.heightCm);
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
