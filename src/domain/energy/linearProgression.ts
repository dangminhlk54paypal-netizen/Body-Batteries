import { LIFTING_EXERCISES } from '../../types/energy';
import { findVariation } from '../../lib/powerliftingVariations';
import type { LinearProgression, LinearWeekStep, OneRepMaxInput } from '../../types/powerliftingBlock';

// "Tịnh tiến" — the user's own linear block (docs/08 §14,
// docs/nghien-cuu/2026-10-23-tinh-tien-tuyen-tinh-block.md): load up a fixed
// step each week, volume down, the last week a test. The defaults below are
// the owner's starting frame (W1 70% 4×5 … W6 test ~95%); every number is the
// user's to change. Pure — the engine (blockEngine.ts) turns it into sets.

// 4×5, 4×4, 3×4, 3×3, 3×2, then a test single.
const DEFAULT_STEPS: LinearWeekStep[] = [
  { sets: 4, reps: 5 },
  { sets: 4, reps: 4 },
  { sets: 3, reps: 4 },
  { sets: 3, reps: 3 },
  { sets: 3, reps: 2 },
];
const TEST_WEEK: LinearWeekStep = { sets: 1, reps: 1, test: true };

export const LINEAR_DEFAULTS = { startPct: 70, step: 5, stepKg: 2.5, variationOffsetPct: 5 } as const;
// Bounds the wizard's steppers keep to.
export const LINEAR_LIMITS = { minPct: 40, maxPct: 100, maxSets: 10, maxReps: 15 } as const;

// The week table for an `n`-week block: the frame's first weeks, longer
// blocks repeat its last working week, and the final week is the test.
export function defaultLinearWeeks(n: number): LinearWeekStep[] {
  if (n <= 1) return [{ ...TEST_WEEK }];
  const working = Array.from({ length: n - 1 }, (_, i) => ({ ...DEFAULT_STEPS[Math.min(i, DEFAULT_STEPS.length - 1)] }));
  return [...working, { ...TEST_WEEK }];
}

export function defaultLinearProgression(weeks: number): LinearProgression {
  return {
    startPct: LINEAR_DEFAULTS.startPct,
    stepMode: 'pct',
    step: LINEAR_DEFAULTS.step,
    variationOffsetPct: LINEAR_DEFAULTS.variationOffsetPct,
    weeks: defaultLinearWeeks(weeks),
  };
}

// Fits the user's table to a new block length: the rows they set stay, a
// longer block repeats the last working row, and a test week stays last.
export function resizeLinearWeeks(weeks: LinearWeekStep[], n: number): LinearWeekStep[] {
  if (weeks.length === n) return weeks;
  const hasTest = weeks.length > 0 && weeks[weeks.length - 1].test === true;
  const working = hasTest ? weeks.slice(0, -1) : weeks;
  const want = hasTest ? n - 1 : n;
  if (want <= 0) return hasTest ? [weeks[weeks.length - 1]] : weeks.slice(0, n);
  const last = working[working.length - 1] ?? DEFAULT_STEPS[0];
  const rows = Array.from({ length: want }, (_, i) => ({ ...(working[i] ?? last), test: undefined }));
  return hasTest ? [...rows, weeks[weeks.length - 1]] : rows;
}

// "Giữ tạ, tăng volume": one more (or fewer) set on every working week; the
// test week stays a single.
export function addVolume(weeks: LinearWeekStep[], sets: number): LinearWeekStep[] {
  return weeks.map((w) =>
    w.test ? w : { ...w, sets: Math.min(LINEAR_LIMITS.maxSets, Math.max(1, w.sets + sets)) }
  );
}

// %1RM of the straight lift in week `weekIndex` (0-based) — 'pct' mode adds
// the step each week; 'kg' mode keeps the % and adds kg to the bar instead.
export function linearWeekPct(p: LinearProgression, weekIndex: number): number {
  const pct = p.stepMode === 'pct' ? p.startPct + p.step * weekIndex : p.startPct;
  return Math.min(LINEAR_LIMITS.maxPct, Math.max(LINEAR_LIMITS.minPct, pct));
}

// ---- Next block from the last one ------------------------------------------

export type NextBlockOneRepMax = 'same' | 'pct5' | 'kg5';

const roundDown = (kg: number) => Math.floor(kg / 2.5) * 2.5;

// One number carried into the next block: the same, +5% (rounded down to
// 2.5 kg), or +5 kg.
export function bumpKg(kg: number, mode: NextBlockOneRepMax): number {
  return mode === 'pct5' ? roundDown(kg * 1.05) : mode === 'kg5' ? kg + 5 : kg;
}

export function nextBlockTrainingMax(prev: Record<string, number>, mode: NextBlockOneRepMax): Record<string, number> {
  return Object.fromEntries(Object.entries(prev).map(([id, kg]) => [id, bumpKg(kg, mode)]));
}

// ---- Training Max ------------------------------------------------------------

// The common convention (5/3/1): a Training Max of 90% of the max, so the
// block's percentages leave room to grow (docs/nghien-cuu/2026-10-23-tm-rpe-coach.md).
export const TRAINING_MAX_FRACTION = 0.9;

// The suggested TM for one variation from its lift's 1RM (real, from the
// training history, or the beginner-safe estimate): 90% × 1RM × the
// variation's load factor, rounded down to 2.5 kg.
export function suggestTrainingMax(variationId: string, liftOneRepMaxKg: number): number {
  const factor = findVariation(variationId)?.loadFactor ?? 1;
  return roundDown(liftOneRepMaxKg * TRAINING_MAX_FRACTION * factor);
}

// The last block's 1RMs carried into the next one: the same, +5% (rounded down
// to 2.5 kg), or +5 kg per lift. A lift without a 1RM stays without.
export function nextBlockOneRepMax(prev: OneRepMaxInput, mode: NextBlockOneRepMax): OneRepMaxInput {
  const out: OneRepMaxInput = {};
  for (const lift of LIFTING_EXERCISES) {
    const kg = prev[lift];
    if (!kg) continue;
    out[lift] = bumpKg(kg, mode);
  }
  return out;
}
