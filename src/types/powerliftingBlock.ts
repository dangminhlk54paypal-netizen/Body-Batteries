// Types for the S-PL Block Builder — multi-week powerlifting training-block
// planning, layered on top of the existing S-PL logging primitives
// (LiftingExercise/LiftingSet in ./energy, liftingEngine.ts). See
// docs/08-powerlifting-engine.md for the scientific basis behind every
// constant referenced by the engine that consumes these types.
//
// Deliberately its own file rather than folded into energy.ts: energy.ts is
// the metabolic-model type file (profile, logged sessions, expenditure); a
// training block is a planning/programming concept, not a metabolic one —
// same reasoning that gave S-BB its own bodybuildingExercises.ts.

import type { LiftingExercise, LiftingSet } from './energy';

// The four "calculation styles" the user picks for a whole block (S-PL Block
// Builder request) — see docs/08-powerlifting-engine.md §2.1 for the %1RM ×
// set × rep table each one drives.
export type TrainingFocus = 'volume' | 'intensity' | 'normal' | 'peaking';

export const TRAINING_FOCUSES: TrainingFocus[] = ['volume', 'intensity', 'normal', 'peaking'];

// User-declared 1RM per lift at block-creation time. A missing/zero value
// means "estimate it safely" — see blockEngine.estimateBeginnerOneRepMax.
export interface OneRepMaxInput {
  squat?: number;
  bench_press?: number;
  deadlift?: number;
}

// One technique variation trained on a given day (e.g. "paused bench").
// `variationId` indexes POWERLIFTING_VARIATIONS (src/lib/powerliftingVariations.ts)
// and doubles as the i18n suffix (`blockVariations.<id>.label` / `.rationale`)
// — same convention as BodybuildingExercise.id. `role` distinguishes the
// day's main movement (drives that day's full curve %1RM) from a secondary
// movement of the same lift trained afterward at a lighter, engine-derived
// load — both are auto-calculated; neither is an "accessory" (see below).
export interface BlockDayVariation {
  exercise: LiftingExercise;
  variationId: string;
  role: 'main' | 'secondary';
}

// A free-text accessory line item (e.g. "Dumbbell row 3x10") — explicitly
// OUT of auto-calculation scope (user's own request): no %1RM math, no kcal.
// `sets` is the only field the engine touches, and only to apply Deficit
// Mode's 15-20% cut (docs/08 §5.3) — mirrors CustomActivity.nameVi's
// free-text convention rather than requiring a matched library entry.
export interface AccessoryLineItem {
  customName: string;
  sets: number;
  reps: string;
}

// One day of the user's declared WEEKLY TEMPLATE (the wizard's schedule
// step) — structured input, not free text, so the engine never has to parse
// natural language. `dayOfWeek` follows JS Date convention (0 = Sunday).
export interface BlockDayPlan {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  variations: BlockDayVariation[];
  accessories: AccessoryLineItem[];
}

// One resolved (concrete weight/reps) variation after the engine applies
// the focus curve + 1RM + deload/deficit adjustments for a specific week.
export interface ResolvedVariationPlan {
  variation: BlockDayVariation;
  pct1rm: number; // 0-100 — the %1RM this week's curve landed on, BEFORE the variation's own loadFactor
  sets: LiftingSet[]; // concrete weight/reps, rounded to 2.5kg plates
  estimatedKcal: number; // liftingSessionKcal() for these sets alone — no second kcal formula
}

export interface ResolvedDayPlan {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  variations: ResolvedVariationPlan[];
  accessories: AccessoryLineItem[]; // set counts already Deficit-Mode-adjusted if applicable
  totalKcal: number;
  totalMinutes: number;
}

export interface BlockWeekPlan {
  weekNumber: number; // 1-based; the deload week (if any) is the last number
  isDeload: boolean;
  days: ResolvedDayPlan[];
  totalKcal: number;
  // dailyCalorieTarget(profile).appliedDeltaKcal * 7 when Deficit Mode is on,
  // else null — reused from weightGoal.ts, never a second pace formula.
  weeklyDeficitTargetKcal: number | null;
  // Calendar dates (YYYY-MM-DD) this week actually covers — Monday..Sunday,
  // derived from TrainingBlockConfig.weekStartDate. Users plan a block 1-2
  // weeks ahead, so the plan needs a real date reference, not just an
  // abstract "Week N".
  startDate: string;
  endDate: string;
}

export interface TrainingBlockConfig {
  id: string;
  createdAt: number;
  // Monday (YYYY-MM-DD) week 1 starts on — a block is anchored to whichever
  // calendar week the user picks to begin training, not just "week 1/2/3".
  weekStartDate: string;
  progressiveWeeks: number; // N tuần tịnh tiến, NOT counting the deload week
  hasDeload: boolean;
  focus: TrainingFocus;
  schedule: BlockDayPlan[]; // the template — one entry per active training day
  oneRepMax: OneRepMaxInput;
  isBeginnerEstimated: Record<LiftingExercise, boolean>;
  bodyWeightKg: number;
  deficitModeEnabled: boolean;
}

export interface GeneratedBlockPlan {
  config: TrainingBlockConfig;
  weeks: BlockWeekPlan[];
}

// What a UI form (BlockBuilderWizard) builds — `id`/`createdAt` are
// generated by blockStore.createBlock(), never inside a component: calling
// Date.now() during render/an event handler defined in component scope
// trips this codebase's react-hooks/purity lint rule, and a store action is
// the established place for stamping new-record ids (see
// settingsStore.addCustomActivity's `custom_${Date.now()}` convention).
export type NewTrainingBlockConfig = Omit<TrainingBlockConfig, 'id' | 'createdAt'>;
