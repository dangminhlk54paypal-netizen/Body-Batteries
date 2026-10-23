import {
  blockTrainingMax,
  buildFormRows,
  formatFormText,
  formLifts,
  resolvePercents,
  setBlockTrainingMax,
  setFormRows,
  setGroups,
} from '../blockForm';
import { generateBlockPlan } from '../blockEngine';
import { setDaySkipped } from '../blockPlanEdits';
import { parseSetNotation } from '../../training/setNotation';
import type { LiftingSet, UserProfile } from '../../../types/energy';
import type { TrainingBlockConfig } from '../../../types/powerliftingBlock';

const profile: UserProfile = { weightKg: 80, heightCm: 175, age: 28, sex: 'male', occupation: 'sedentary' };
// Comp Bench twice a week (Mon, Fri), squat on Wednesday.
const config: TrainingBlockConfig = {
  id: 'b',
  createdAt: 1,
  weekStartDate: '2026-09-07',
  progressiveWeeks: 3,
  hasDeload: false,
  focus: 'volume',
  schedule: [
    { dayOfWeek: 1, variations: [{ exercise: 'bench_press', variationId: 'bench_paused', role: 'main' }], accessories: [] },
    { dayOfWeek: 3, variations: [{ exercise: 'squat', variationId: 'squat_standard', role: 'main' }], accessories: [] },
    { dayOfWeek: 5, variations: [{ exercise: 'bench_press', variationId: 'bench_paused', role: 'main' }], accessories: [] },
  ],
  oneRepMax: { squat: 200, bench_press: 120, deadlift: 250 },
  isBeginnerEstimated: { squat: false, bench_press: false, deadlift: false },
  bodyWeightKg: 80,
  deficitModeEnabled: false,
  trainingMax: { squat_standard: 190 },
};
const plan = () => generateBlockPlan(config, profile);
const sets = (...s: [number, number][]): LiftingSet[] => s.map(([reps, weightKg]) => ({ kind: 'working', reps, weightKg }));

describe('blockForm', () => {
  it('lists each variation once, in plan order', () => {
    expect(formLifts(plan()).map((l) => l.variationId)).toEqual(['bench_paused', 'squat_standard']);
  });

  it('takes the user TM, else 1RM × load factor', () => {
    expect(blockTrainingMax(plan(), 'squat_standard', 'squat')).toBe(190);
    expect(blockTrainingMax(plan(), 'bench_paused', 'bench_press')).toBe(108);
  });

  it('has a row per session, and counts sessions in the same week', () => {
    const rows = buildFormRows(plan(), 'bench_paused');
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.dayOfWeek)).toEqual([1, 5, 1, 5, 1, 5]);
    expect(rows.every((r) => r.sameWeekCount === 2)).toBe(true);
    expect(buildFormRows(plan(), 'squat_standard')[0].sameWeekCount).toBe(1);
  });

  it('groups equal sets and gives % of the TM', () => {
    const g = setGroups(sets([1, 110], [5, 95], [5, 95], [5, 95]), 117.5);
    expect(g).toEqual([
      { sets: 1, reps: 1, weightKg: 110, pct: 94, prime: false },
      { sets: 3, reps: 5, weightKg: 95, pct: 81, prime: false },
    ]);
  });

  it('writes the form text the parser reads back', () => {
    const s: LiftingSet[] = [{ kind: 'warmup', reps: 1, weightKg: 95 }, ...sets([5, 72.5], [5, 72.5])];
    expect(formatFormText(s, 'vi')).toBe('95 + 2x5@72,5');
    expect(formatFormText(sets([1, 110], [5, 95], [5, 95]), 'en')).toBe('1x1@110 2x5@95');
    const back = parseSetNotation(formatFormText(s, 'vi'));
    expect(back.ok && back.sets).toEqual(s);
  });

  it('turns % of the TM into kg, rounded to 2.5', () => {
    expect(resolvePercents('94% 5x5@81%', 117.5)).toBe('110 5x5@95');
    expect(resolvePercents('5x5@82,5%', 200)).toBe('5x5@165');
    expect(resolvePercents('5x5@95', 0)).toBe('5x5@95');
    expect(resolvePercents('5x5@80%', 0)).toBeNull();
  });

  it('a new TM moves open sessions and keeps their %, trained and off ones stay', () => {
    const lifted = new Set(['2026-09-07']); // week 1 Monday trained
    let p = setDaySkipped(plan(), { weekIndex: 1, dayIndex: 2 }, true); // week 2 Friday off
    p = setFormRows(
      p,
      buildFormRows(p, 'bench_paused').map((r) => ({ at: r.at, sets: sets([5, 100]) })),
      175
    );
    const next = setBlockTrainingMax(p, { variationId: 'bench_paused', exercise: 'bench_press' }, 120, 175, lifted);
    expect(next.config.trainingMax).toEqual({ squat_standard: 190, bench_paused: 120 });
    const weights = buildFormRows(next, 'bench_paused', lifted).map((r) => r.sets[0].weightKg);
    // 100 × 120 / 108 = 111.1 → 110; W1 Mon trained, W2 Fri off.
    expect(weights).toEqual([100, 110, 110, 100, 110, 110]);
  });
});
