import {
  liftingSetKcal,
  liftingSessionKcal,
  estimateLiftingMinutes,
  liftingTonnageKg,
  estimatedOneRepMax,
  bestOneRepMax,
  warmupRamp,
} from '../liftingEngine';
import type { LiftingSet } from '../../../types/energy';

// The user's own example body: 78 kg, 168 cm.
const BODY_KG = 78;
const BODY_CM = 168;

const workingSet = (weightKg: number, reps: number): LiftingSet => ({
  kind: 'working',
  weightKg,
  reps,
});
const warmupSet = (weightKg: number, reps: number): LiftingSet => ({
  kind: 'warmup',
  weightKg,
  reps,
});

// A realistic squat exercise: bar → 50 → 70 → 85 warm-up ramp, then 5×5@100.
const squatSession: LiftingSet[] = [
  warmupSet(20, 10),
  warmupSet(50, 6),
  warmupSet(70, 4),
  warmupSet(85, 2),
  ...Array.from({ length: 5 }, () => workingSet(100, 5)),
];

describe('liftingSetKcal (mechanical work / efficiency)', () => {
  it('squat 5 reps @ 100kg ≈ 5.5 kcal at 78kg/168cm', () => {
    // m_eff = 100 + 0.88×78 = 168.64 kg; ROM = 0.25×1.68 = 0.42 m
    // 168.64 × 9.81 × 0.42 × 5 reps × 1.33 / 0.20 / 4184 ≈ 5.52 kcal
    expect(liftingSetKcal('squat', workingSet(100, 5), BODY_KG, BODY_CM)).toBeCloseTo(5.52, 1);
  });

  it('bench press costs less than squat for the same bar weight (Robergs 2007)', () => {
    const bench = liftingSetKcal('bench_press', workingSet(80, 5), BODY_KG, BODY_CM);
    const squat = liftingSetKcal('squat', workingSet(80, 5), BODY_KG, BODY_CM);
    expect(bench).toBeLessThan(squat);
    expect(bench).toBeGreaterThan(0);
  });

  it('scales with bar weight, reps, and body size', () => {
    const base = liftingSetKcal('deadlift', workingSet(100, 5), BODY_KG, BODY_CM);
    expect(liftingSetKcal('deadlift', workingSet(140, 5), BODY_KG, BODY_CM)).toBeGreaterThan(base);
    expect(liftingSetKcal('deadlift', workingSet(100, 8), BODY_KG, BODY_CM)).toBeGreaterThan(base);
    expect(liftingSetKcal('deadlift', workingSet(100, 5), 90, 185)).toBeGreaterThan(base);
  });

  it('empty-bar and bodyweight-only sets still cost something; non-sets cost 0', () => {
    expect(liftingSetKcal('squat', workingSet(0, 10), BODY_KG, BODY_CM)).toBeGreaterThan(0);
    expect(liftingSetKcal('squat', workingSet(100, 0), BODY_KG, BODY_CM)).toBe(0);
    expect(liftingSetKcal('squat', workingSet(-5, 5), BODY_KG, BODY_CM)).toBe(0);
  });
});

describe('estimateLiftingMinutes', () => {
  it('warm-up sets are shorter cycles than working sets (1.5 vs 3 min)', () => {
    // 4 warm-ups × 1.5 + 5 working × 3 = 21 minutes
    expect(estimateLiftingMinutes(squatSession)).toBe(21);
    expect(estimateLiftingMinutes([])).toBe(0);
  });
});

describe('liftingSessionKcal (hybrid: work + rest overhead)', () => {
  it('the full squat example lands near 100 kcal — work ~44 + rest ~55', () => {
    // rest = 2.0 MET × 78 kg × (21/60 h) = 54.6 kcal; work ≈ 43.7 kcal
    const kcal = liftingSessionKcal('squat', squatSession, BODY_KG, BODY_CM);
    expect(kcal).toBeGreaterThanOrEqual(90);
    expect(kcal).toBeLessThanOrEqual(110);
  });

  it('a 3-lift session stays in the whole-session VO2 ballpark (~250–350 kcal, João 2021)', () => {
    const bench: LiftingSet[] = [
      warmupSet(20, 10),
      warmupSet(40, 6),
      warmupSet(55, 3),
      ...Array.from({ length: 5 }, () => workingSet(70, 5)),
    ];
    const deadlift: LiftingSet[] = [
      warmupSet(60, 5),
      warmupSet(90, 3),
      warmupSet(110, 2),
      ...Array.from({ length: 3 }, () => workingSet(130, 5)),
    ];
    const total =
      liftingSessionKcal('squat', squatSession, BODY_KG, BODY_CM) +
      liftingSessionKcal('bench_press', bench, BODY_KG, BODY_CM) +
      liftingSessionKcal('deadlift', deadlift, BODY_KG, BODY_CM);
    expect(total).toBeGreaterThanOrEqual(220);
    expect(total).toBeLessThanOrEqual(380);
  });
});

describe('liftingTonnageKg', () => {
  it('sums bar weight × reps across all sets', () => {
    // 200 + 300 + 280 + 170 + 5×500 = 3450
    expect(liftingTonnageKg(squatSession)).toBe(3450);
  });
});

describe('estimatedOneRepMax (Epley) + bestOneRepMax', () => {
  it('100kg × 5 → 116.7; a single is its own max', () => {
    expect(estimatedOneRepMax(100, 5)).toBeCloseTo(116.7, 1);
    expect(estimatedOneRepMax(120, 1)).toBe(120);
    expect(estimatedOneRepMax(0, 5)).toBe(0);
  });

  it('bestOneRepMax reads working sets only (warm-ups are submaximal noise)', () => {
    expect(bestOneRepMax(squatSession)).toBeCloseTo(116.7, 1);
    expect(bestOneRepMax([warmupSet(180, 1)])).toBe(0);
  });
});

describe('warmupRamp', () => {
  it('ramps bar → 50% → 70% → 85% toward 100kg, on 2.5kg plates', () => {
    expect(warmupRamp(100)).toEqual([
      { kind: 'warmup', weightKg: 20, reps: 10 },
      { kind: 'warmup', weightKg: 50, reps: 6 },
      { kind: 'warmup', weightKg: 70, reps: 4 },
      { kind: 'warmup', weightKg: 85, reps: 2 },
    ]);
  });

  it('drops rungs that collapse into the bar or the working weight itself', () => {
    expect(warmupRamp(20)).toEqual([{ kind: 'warmup', weightKg: 20, reps: 10 }]);
    // 30kg working: 50% → 15 (≤ bar, dropped), 70% → 20 (≤ bar, dropped),
    // 85% → 25.5 → 25 (kept)
    expect(warmupRamp(30)).toEqual([
      { kind: 'warmup', weightKg: 20, reps: 10 },
      { kind: 'warmup', weightKg: 25, reps: 2 },
    ]);
  });
});
