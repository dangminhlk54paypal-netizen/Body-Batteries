import { applyCoachChange, coachAdvice, dismissAdvice, rpeLogs, setVariationRpe, targetRpeOf } from '../rpeCoach';
import { generateBlockPlan } from '../blockEngine';
import { setVariationSets } from '../blockPlanEdits';
import type { UserProfile } from '../../../types/energy';
import type { GeneratedBlockPlan, TrainingBlockConfig } from '../../../types/powerliftingBlock';

const profile: UserProfile = { weightKg: 80, heightCm: 175, age: 28, sex: 'male', occupation: 'sedentary' };
// Monday bench (main), Thursday squat (main); 4 weeks of 'intensity' (RPE model).
const config: TrainingBlockConfig = {
  id: 'r',
  createdAt: 1,
  weekStartDate: '2026-09-07',
  progressiveWeeks: 4,
  hasDeload: false,
  focus: 'intensity',
  schedule: [
    { dayOfWeek: 1, variations: [{ exercise: 'bench_press', variationId: 'bench_touch_and_go', role: 'main' }], accessories: [] },
    { dayOfWeek: 4, variations: [{ exercise: 'squat', variationId: 'squat_standard', role: 'main' }], accessories: [] },
  ],
  oneRepMax: { squat: 160, bench_press: 100, deadlift: 200 },
  isBeginnerEstimated: { squat: false, bench_press: false, deadlift: false },
  bodyWeightKg: 80,
  deficitModeEnabled: false,
};
const plan = () => generateBlockPlan(config, profile);
const rate = (p: GeneratedBlockPlan, weekIndex: number, dayIndex: number, rpe: number | null) =>
  setVariationRpe(p, { weekIndex, dayIndex, variationIndex: 0 }, rpe);
const target = (p: GeneratedBlockPlan, w: number, d: number) => targetRpeOf(p.weeks[w].days[d].variations[0])!;

describe('RPE coach', () => {
  it('stores and clears a rating; logs list rated sessions in order', () => {
    let p = rate(rate(plan(), 1, 0, 8), 0, 0, 7);
    expect(rpeLogs(p, 'bench_touch_and_go').map((l) => [l.weekIndex, l.actual])).toEqual([[0, 7], [1, 8]]);
    p = rate(p, 1, 0, null);
    expect(rpeLogs(p, 'bench_touch_and_go')).toHaveLength(1);
    expect(rpeLogs(p, 'bench_touch_and_go')[0].date).toBe('2026-09-07');
  });

  it('one easy session is not enough (two in a row are)', () => {
    const p = plan();
    const once = rate(p, 0, 0, target(p, 0, 0) - 2);
    expect(coachAdvice(once)).toEqual([]);
    const twice = rate(once, 1, 0, target(p, 1, 0) - 2);
    const [advice] = coachAdvice(twice);
    expect(advice).toMatchObject({ variationId: 'bench_touch_and_go', direction: 'easier', loadKg: 2.5, fromWeekIndex: 2 });
    expect(advice.offerSet).toBe(true); // 4 bench working sets a week < 10
  });

  it('two hard squat sessions → 5 kg less; mixed sessions → nothing', () => {
    const p = plan();
    const hard = rate(rate(p, 0, 1, target(p, 0, 1) + 1.5), 1, 1, target(p, 1, 1) + 1);
    expect(coachAdvice(hard)).toEqual([expect.objectContaining({ exercise: 'squat', direction: 'harder', loadKg: -5 })]);
    const mixed = rate(rate(p, 0, 1, target(p, 0, 1) + 1.5), 1, 1, target(p, 1, 1));
    expect(coachAdvice(mixed)).toEqual([]);
  });

  it('nothing to suggest after the last week, or once dismissed', () => {
    const p = plan();
    const late = rate(rate(p, 2, 0, 5), 3, 0, 5);
    expect(coachAdvice(late)).toEqual([]);
    const early = rate(rate(p, 0, 0, 5), 1, 0, 5);
    const [advice] = coachAdvice(early);
    expect(coachAdvice(dismissAdvice(early, advice.key))).toEqual([]);
  });

  it('sets the user rewrote have no target — only RPE 9.5+ twice still counts as too hard', () => {
    let p = plan();
    const mine = [{ kind: 'working' as const, weightKg: 90, reps: 3 }];
    p = setVariationSets(p, { weekIndex: 0, dayIndex: 0, variationIndex: 0 }, mine, 175);
    p = setVariationSets(p, { weekIndex: 1, dayIndex: 0, variationIndex: 0 }, mine, 175);
    expect(coachAdvice(rate(rate(p, 0, 0, 6), 1, 0, 6))).toEqual([]);
    expect(coachAdvice(rate(rate(p, 0, 0, 9.5), 1, 0, 10))[0]?.direction).toBe('harder');
  });

  it('Apply: +2.5 kg and one more set on every later bench session; earlier weeks and the prime untouched', () => {
    const p = plan();
    const after = applyCoachChange(p, 'bench_touch_and_go', 2, { kg: 2.5, sets: 1 }, 175);
    expect(after.weeks[1].days[0].variations[0].sets).toEqual(p.weeks[1].days[0].variations[0].sets);
    for (const w of [2, 3]) {
      const before = p.weeks[w].days[0].variations[0].sets;
      const now = after.weeks[w].days[0].variations[0];
      const prime = before.find((s) => s.kind === 'warmup');
      if (prime) expect(now.sets[0]).toEqual(prime);
      const working = before.filter((s) => s.kind === 'working');
      expect(now.sets.filter((s) => s.kind === 'working')).toHaveLength(working.length + 1);
      expect(now.sets.filter((s) => s.kind === 'working')[0].weightKg).toBe(working[0].weightKg + 2.5);
      expect(now.userEdited).toBe(true);
    }
    expect(after.weeks[2].days[1].variations[0].sets).toEqual(p.weeks[2].days[1].variations[0].sets); // squat untouched
  });
});
