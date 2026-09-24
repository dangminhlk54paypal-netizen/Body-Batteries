import { bestLiftMaxes, buildProgressChartModel, liftChanges, starPoints } from '../progressChartModel';
import type { ChartLayout } from '../progressChartModel';
import type { LiftProgressWeek } from '../trainingLogProgress';
import type { LiftMaxRecord } from '../../../types/trainingLog';

const LAYOUT: ChartLayout = { width: 320, height: 170, padLeft: 34, padRight: 22, padTop: 12, padBottom: 22 };

const week = (weekStart: string, top: LiftProgressWeek['top'], bodyWeightKg: number | null = 80): LiftProgressWeek => ({
  weekStart,
  weekEnd: weekStart,
  bodyWeightKg,
  bodyWeightSource: bodyWeightKg == null ? null : 'measured',
  top,
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
