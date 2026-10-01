import { bestLiftMaxes, buildProgressChartModel, liftChanges, liftDeltaAt, starPoints, weekValue } from '../progressChartModel';
import type { ChartLayout } from '../progressChartModel';
import type { LiftProgressWeek } from '../trainingLogProgress';
import type { LiftMaxRecord } from '../../../types/trainingLog';

const LAYOUT: ChartLayout = { width: 320, height: 170, padLeft: 34, padRight: 22, padTop: 12, padBottom: 22 };

// e1rm defaults to `top` (as if every top set were a single) so the kg and
// ratio modes plot the same lifts unless a test says otherwise.
const week = (
  weekStart: string,
  top: LiftProgressWeek['top'],
  bodyWeightKg: number | null = 80,
  e1rm: LiftProgressWeek['e1rm'] = top
): LiftProgressWeek => ({
  weekStart,
  weekEnd: weekStart,
  bodyWeightKg,
  bodyWeightSource: bodyWeightKg == null ? null : 'measured',
  top,
  e1rm,
});
const max = (id: string, lift: LiftMaxRecord['lift'], weightKg: number, date: string): LiftMaxRecord => ({
  id,
  lift,
  weightKg,
  date,
  note: null,
  createdAt: 1,
});

const weeks = [week('2026-08-03', { squat: 150, bench_press: 100 }), week('2026-08-17', { squat: 160 })];

describe('buildProgressChartModel', () => {
  it('plots weekly lines and a ⭐ per 1RM on its own day, never on the line', () => {
    const m = buildProgressChartModel({
      weeks,
      maxes: [max('m1', 'squat', 180, '2026-08-12')],
      bodyWeightOf: () => 80,
      mode: 'kg',
      layout: LAYOUT,
    })!;
    const squat = m.series.find((s) => s.lift === 'squat')!;
    expect(squat.points).toHaveLength(2);
    expect(m.stars).toHaveLength(1);
    // Between the two weeks on the x axis, above both weekly squat points.
    expect(m.stars[0].x).toBeGreaterThan(squat.points[0].x);
    expect(m.stars[0].x).toBeLessThan(squat.points[1].x);
    expect(m.stars[0].y).toBeLessThan(squat.points[1].y);
    // The y axis grew to fit the star.
    expect(m.ticks[m.ticks.length - 1]).toBeGreaterThanOrEqual(180);
  });

  it('widens the x axis to a star outside the weekly range', () => {
    const m = buildProgressChartModel({
      weeks,
      maxes: [max('m1', 'deadlift', 220, '2026-08-30')],
      bodyWeightOf: () => 80,
      mode: 'kg',
      layout: LAYOUT,
    })!;
    expect(m.lastDate).toBe('2026-08-30');
    expect(m.stars[0].x).toBeCloseTo(LAYOUT.width - LAYOUT.padRight);
  });

  it('ratio mode divides a star by the body weight of its day, and skips it without one', () => {
    const withBw = buildProgressChartModel({
      weeks,
      maxes: [max('m1', 'squat', 180, '2026-08-12')],
      bodyWeightOf: () => 90,
      mode: 'ratio',
      layout: LAYOUT,
    })!;
    expect(withBw.stars[0].value).toBeCloseTo(2);
    const noBw = buildProgressChartModel({
      weeks,
      maxes: [max('m1', 'squat', 180, '2026-08-12')],
      bodyWeightOf: () => null,
      mode: 'ratio',
      layout: LAYOUT,
    })!;
    expect(noBw.stars).toEqual([]);
  });

  it('one week plus one star is already a chart; a single mark is not', () => {
    const one = [week('2026-08-03', { squat: 150 })];
    expect(buildProgressChartModel({ weeks: one, maxes: [], bodyWeightOf: () => 80, mode: 'kg', layout: LAYOUT })).toBeNull();
    expect(
      buildProgressChartModel({
        weeks: one,
        maxes: [max('m1', 'squat', 170, '2026-08-20')],
        bodyWeightOf: () => 80,
        mode: 'kg',
        layout: LAYOUT,
      })
    ).not.toBeNull();
  });
});

describe('bestLiftMaxes / starPoints', () => {
  it('keeps the heaviest 1RM per lift (the later one on a tie)', () => {
    const best = bestLiftMaxes([
      max('a', 'squat', 180, '2026-06-01'),
      max('b', 'squat', 185, '2026-07-01'),
      max('c', 'squat', 185, '2026-08-01'),
      max('d', 'bench_press', 120, '2026-08-01'),
    ]);
    expect(best.squat?.id).toBe('c');
    expect(best.bench_press?.id).toBe('d');
    expect(best.deadlift).toBeUndefined();
  });

  it('a star has 10 corners, the first straight above the centre', () => {
    const pts = starPoints(50, 50, 10).split(' ');
    expect(pts).toHaveLength(10);
    expect(pts[0]).toBe('50.00,40.00');
  });
});

describe('liftChanges — how far each lift moved, in the mode shown', () => {
  it('a cut: +5% on the bar is +10.5% × body weight', () => {
    const weeks = [week('2026-07-27', { squat: 100 }, 80), week('2026-09-21', { squat: 105 }, 76)];
    const [kg] = liftChanges(weeks, 'kg');
    const [ratio] = liftChanges(weeks, 'ratio');
    expect(kg.pct).toBeCloseTo(5, 5);
    expect(ratio.pct).toBeCloseTo(((105 / 76) / (100 / 80) - 1) * 100, 5);
    expect(ratio.pct).toBeGreaterThan(10);
  });

  it('leaves out a lift with a single value', () => {
    expect(liftChanges([week('2026-07-27', { squat: 100, bench_press: 70 }), week('2026-08-03', { squat: 102.5 })], 'kg').map((c) => c.lift)).toEqual(['squat']);
  });
});

describe('weekValue — kg is the heaviest set, ratio is e1RM ÷ body weight', () => {
  it('ratio uses the estimated 1RM, not the heaviest set', () => {
    // 4 reps at 100 kg → e1RM 113.3; at 80 kg body weight that is 1.42×, not 1.25×.
    const w = week('2026-08-03', { squat: 100 }, 80, { squat: 113.3 });
    expect(weekValue(w, 'squat', 'kg')).toBe(100);
    expect(weekValue(w, 'squat', 'ratio')).toBeCloseTo(113.3 / 80, 5);
  });

  it('no e1RM (only sets above 10 reps) or no body weight → no ratio point', () => {
    expect(weekValue(week('2026-08-03', { squat: 60 }, 80, {}), 'squat', 'ratio')).toBeNull();
    expect(weekValue(week('2026-08-03', { squat: 100 }, null), 'squat', 'ratio')).toBeNull();
  });
});

describe('liftDeltaAt — the value and change shown in each S/B/D tile', () => {
  const ws = [
    week('2026-07-27', { bench_press: 100 }),
    week('2026-08-03', { squat: 150, bench_press: 95 }),
    week('2026-08-10', { squat: 160 }),
  ];
  it('change since the lift’s own first week, up to the selected week', () => {
    expect(liftDeltaAt(ws, 'squat', 'kg', 2)).toEqual({ value: 160, pct: (10 / 150) * 100 });
    expect(liftDeltaAt(ws, 'bench_press', 'kg', 1).pct).toBeCloseTo(-5, 5);
  });
  it('first week of a lift → no change; week without the lift → nothing', () => {
    expect(liftDeltaAt(ws, 'squat', 'kg', 1)).toEqual({ value: 150, pct: null });
    expect(liftDeltaAt(ws, 'bench_press', 'kg', 2)).toEqual({ value: null, pct: null });
  });
});
