import {
  bbEffectiveMet,
  bbSetMinutes,
  estimateBbMinutes,
  bodybuildingSessionKcal,
  bodybuildingTonnageKg,
} from '../bodybuildingEngine';
import type { LiftingSet, WorkoutSession } from '../../../types/energy';

// The user's own example body: 78 kg.
const BODY_KG = 78;

const set = (weightKg: number, reps: number): LiftingSet => ({
  kind: 'working',
  weightKg,
  reps,
});

describe('bbEffectiveMet', () => {
  it('isolation/moderate = 3.5 MET (Compendium 02054)', () => {
    expect(bbEffectiveMet('isolation', 'moderate')).toBeCloseTo(3.5, 5);
  });

  it('compound/moderate = 5.0 MET (Compendium 02052)', () => {
    expect(bbEffectiveMet('compound', 'moderate')).toBeCloseTo(5.0, 5);
  });

  it('big_compound/moderate = 6.0 MET (Compendium 02050)', () => {
    expect(bbEffectiveMet('big_compound', 'moderate')).toBeCloseTo(6.0, 5);
  });

  it('superset pushes compound up near the circuit-training code (02055 = 5.8)', () => {
    expect(bbEffectiveMet('compound', 'superset')).toBeCloseTo(5.75, 5);
  });

  it('light pulls the tier down', () => {
    expect(bbEffectiveMet('isolation', 'light')).toBeCloseTo(3.15, 5);
  });
});

describe('bbSetMinutes / estimateBbMinutes', () => {
  it('10 reps = 1.5 minutes (10×3s + 60s rest = 90s)', () => {
    expect(bbSetMinutes(10)).toBeCloseTo(1.5, 5);
  });

  it('non-positive reps cost 0 minutes', () => {
    expect(bbSetMinutes(0)).toBe(0);
    expect(bbSetMinutes(-3)).toBe(0);
  });

  it('4 sets of 10 reps round to 6 minutes', () => {
    const sets = Array.from({ length: 4 }, () => set(15, 10));
    expect(estimateBbMinutes(sets)).toBe(6);
    expect(estimateBbMinutes([])).toBe(0);
  });

  it('more reps per set means more minutes', () => {
    const fewer = estimateBbMinutes([set(15, 5)]);
    const more = estimateBbMinutes([set(15, 15)]);
    expect(more).toBeGreaterThan(fewer);
  });
});

describe('bodybuildingSessionKcal', () => {
  it('4×10 cable curl (isolation, moderate) @ 78kg ≈ 27 kcal', () => {
    // effMET = 3.5; minutes = 6; kcal = round(3.5 × 78 × (6/60)) = round(27.3) = 27
    const session: WorkoutSession = {
      type: 'bodybuilding',
      minutes: 6,
      sets: Array.from({ length: 4 }, () => set(15, 10)),
      bbExerciseId: 'cable_curl',
      bbMuscle: 'biceps',
      bbMet: bbEffectiveMet('isolation', 'moderate'),
    };
    expect(bodybuildingSessionKcal(session, BODY_KG)).toBe(27);
  });

  it('0 sets → 0 kcal', () => {
    const session: WorkoutSession = {
      type: 'bodybuilding',
      minutes: 0,
      sets: [],
      bbExerciseId: 'cable_curl',
      bbMuscle: 'biceps',
      bbMet: bbEffectiveMet('isolation', 'moderate'),
    };
    expect(bodybuildingSessionKcal(session, BODY_KG)).toBe(0);
  });

  it('missing bbMet (not a bodybuilding session) → 0 kcal, no throw', () => {
    const session: WorkoutSession = {
      type: 'bodybuilding',
      minutes: 6,
      sets: [set(15, 10)],
    };
    expect(bodybuildingSessionKcal(session, BODY_KG)).toBe(0);
  });

  it('superset intensity costs more than moderate for the same sets', () => {
    const sets = Array.from({ length: 3 }, () => set(20, 12));
    const moderate: WorkoutSession = {
      type: 'bodybuilding',
      minutes: estimateBbMinutes(sets),
      sets,
      bbMet: bbEffectiveMet('compound', 'moderate'),
    };
    const superset: WorkoutSession = {
      type: 'bodybuilding',
      minutes: estimateBbMinutes(sets),
      sets,
      bbMet: bbEffectiveMet('compound', 'superset'),
    };
    expect(bodybuildingSessionKcal(superset, BODY_KG)).toBeGreaterThan(
      bodybuildingSessionKcal(moderate, BODY_KG)
    );
  });

  it('bodyweight-only sets (weightKg 0) still cost kcal — reps drive the model, not weight', () => {
    const session: WorkoutSession = {
      type: 'bodybuilding',
      minutes: estimateBbMinutes([set(0, 15)]),
      sets: [set(0, 15)],
      bbMet: bbEffectiveMet('isolation', 'moderate'),
    };
    expect(bodybuildingSessionKcal(session, BODY_KG)).toBeGreaterThan(0);
  });

  it('large rep counts scale up kcal', () => {
    const base: WorkoutSession = {
      type: 'bodybuilding',
      minutes: estimateBbMinutes([set(20, 8)]),
      sets: [set(20, 8)],
      bbMet: bbEffectiveMet('compound', 'moderate'),
    };
    const high: WorkoutSession = {
      type: 'bodybuilding',
      minutes: estimateBbMinutes([set(20, 30)]),
      sets: [set(20, 30)],
      bbMet: bbEffectiveMet('compound', 'moderate'),
    };
    expect(bodybuildingSessionKcal(high, BODY_KG)).toBeGreaterThan(
      bodybuildingSessionKcal(base, BODY_KG)
    );
  });
});

describe('bodybuildingTonnageKg', () => {
  it('sums bar/dumbbell weight × reps (same as liftingTonnageKg)', () => {
    const sets = [set(15, 10), set(15, 10), set(15, 8)];
    expect(bodybuildingTonnageKg(sets)).toBe(15 * 10 + 15 * 10 + 15 * 8);
  });
});
