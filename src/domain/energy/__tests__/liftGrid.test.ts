import { buildLiftGrid, liftsInPlan } from '../liftGrid';
import { generateBlockPlan } from '../blockEngine';
import { setDaySkipped, setWeekSkipped } from '../blockPlanEdits';
import { LIFTING_EXERCISES } from '../../../types/energy';
import type { UserProfile } from '../../../types/energy';
import type { TrainingBlockConfig } from '../../../types/powerliftingBlock';

const profile: UserProfile = { weightKg: 80, heightCm: 175, age: 28, sex: 'male', occupation: 'sedentary' };
// Bench on Friday (touch-and-go) and Monday (paused + incline), squat on Wednesday.
const config: TrainingBlockConfig = {
  id: 'b',
  createdAt: 1,
  weekStartDate: '2026-09-07',
  progressiveWeeks: 3,
  hasDeload: true,
  focus: 'volume',
  schedule: [
    {
      dayOfWeek: 5,
      variations: [{ exercise: 'bench_press', variationId: 'bench_touch_and_go', role: 'main' }],
      accessories: [],
    },
    {
      dayOfWeek: 1,
      variations: [
        { exercise: 'bench_press', variationId: 'bench_paused', role: 'main' },
        { exercise: 'bench_press', variationId: 'bench_incline', role: 'secondary' },
      ],
      accessories: [],
    },
    {
      dayOfWeek: 3,
      variations: [{ exercise: 'squat', variationId: 'squat_standard', role: 'main' }],
      accessories: [],
    },
  ],
  oneRepMax: { squat: 200, bench_press: 120, deadlift: 250 },
  isBeginnerEstimated: { squat: false, bench_press: false, deadlift: false },
  bodyWeightKg: 80,
  deficitModeEnabled: false,
};
const plan = () => generateBlockPlan(config, profile);

describe('buildLiftGrid', () => {
  it('lists only the lifts the block has, in the usual order', () => {
    expect(liftsInPlan(plan(), LIFTING_EXERCISES)).toEqual(['squat', 'bench_press']);
  });

  it('has a row per week and a column per bench weekday, Monday first', () => {
    const grid = buildLiftGrid(plan(), 'bench_press');
    expect(grid.weekdays).toEqual([1, 5]);
    expect(grid.rows).toHaveLength(4);
    const monday = grid.rows[1].cells[0]!;
    expect(monday.date).toBe('2026-09-14');
    expect(monday.items.map((it) => it.variation.variation.variationId)).toEqual(['bench_paused', 'bench_incline']);
    const p = plan();
    // The addresses point at the real plan entries.
    expect(p.weeks[1].days[monday.dayIndex].variations[monday.items[1].variationIndex].variation.variationId).toBe(
      'bench_incline'
    );
  });

  it('a squat grid has only Wednesday', () => {
    const grid = buildLiftGrid(plan(), 'squat');
    expect(grid.weekdays).toEqual([3]);
    expect(grid.rows.every((r) => r.cells[0]?.items.length === 1)).toBe(true);
  });

  it('marks days and weeks the user took off', () => {
    const p = setDaySkipped(setWeekSkipped(plan(), 2, true), { weekIndex: 0, dayIndex: 0 }, true);
    const grid = buildLiftGrid(p, 'bench_press');
    expect(grid.rows[2].cells.every((c) => c?.skipped)).toBe(true);
    const offDay = p.weeks[0].days[0].dayOfWeek; // the first day in plan order
    expect(grid.rows[0].cells[grid.weekdays.indexOf(offDay)]?.skipped).toBe(true);
  });

  it('colours each square: trained (the day is in the log), not yet, or taken off', () => {
    const p = setWeekSkipped(plan(), 2, true);
    const grid = buildLiftGrid(p, 'bench_press', new Set(['2026-09-07'])); // Monday of week 1 trained
    expect(grid.rows[0].cells[0]?.state).toBe('done');
    expect(grid.rows[0].cells[1]?.state).toBe('open'); // Friday not yet
    expect(grid.rows[2].cells.every((c) => c?.state === 'skipped')).toBe(true);
  });
});
