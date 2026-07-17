import type { BbIntensity, BbMetTier, LiftingSet, WorkoutSession } from '../../types/energy';
import {
  BB_INTENSITY_FACTOR,
  BB_MET_TIER,
  BB_REST_SEC,
  BB_SEC_PER_REP,
} from '../../lib/metabolicConstants';
import { liftingTonnageKg } from './liftingEngine';

// Pure functions for the S-BB set-based bodybuilding-by-muscle-group energy
// model. docs/06-energy-expenditure.md §1C has the derivation + sources.
//
// Unlike liftingEngine.ts (S-PL: physics — mechanical work / efficiency),
// this model prices a set purely from a MET tier × intensity factor and the
// nominal time the set occupies (reps × seconds/rep + rest). The bar/dumbbell
// weight logged in each LiftingSet is kept for tonnage/volume display only —
// it deliberately does NOT feed the kcal formula, matching the research
// finding that per-exercise mechanical work isn't a reliable estimator for
// isolation movements.

// Effective MET for one exercise: its tier's base MET × the chosen
// intensity/rest-style multiplier.
export function bbEffectiveMet(tier: BbMetTier, intensity: BbIntensity): number {
  return BB_MET_TIER[tier] * BB_INTENSITY_FACTOR[intensity];
}

// Nominal minutes ONE set occupies: time under tension (reps × sec/rep) plus
// the nominal rest after it. Non-positive reps mean "not a set" → 0 minutes.
export function bbSetMinutes(reps: number): number {
  if (reps <= 0) return 0;
  return (reps * BB_SEC_PER_REP + BB_REST_SEC) / 60;
}

// Estimated wall-clock minutes a list of sets occupies — stored as the
// WorkoutSession's `minutes`, same role estimateLiftingMinutes plays for S-PL.
export function estimateBbMinutes(sets: LiftingSet[]): number {
  return Math.round(sets.reduce((min, s) => min + bbSetMinutes(s.reps), 0));
}

// Full kcal for one exercise's sets: effMET × bodyweight × (session minutes
// / 60). `session.bbMet` must already be the snapshotted effective MET (see
// WorkoutSession.bbMet) — this function does NOT re-derive it from a tier, so
// a later change to BB_MET_TIER/BB_INTENSITY_FACTOR never rewrites history.
export function bodybuildingSessionKcal(session: WorkoutSession, weightKg: number): number {
  if (!session.sets?.length || session.bbMet == null) return 0;
  const minutes = estimateBbMinutes(session.sets);
  return Math.round(session.bbMet * weightKg * (minutes / 60));
}

// Total bar/dumbbell-weight volume (kg lifted) — reused from liftingEngine
// for the same "strength progress" display S-PL already shows.
export function bodybuildingTonnageKg(sets: LiftingSet[]): number {
  return liftingTonnageKg(sets);
}
