import { utils } from 'xlsx';
import { buildPlanCrosstab } from '../trainingBlockPrintSheet';
import { generateBlockPlan } from '../../../domain/energy/blockEngine';
import type { UserProfile } from '../../../types/energy';
import type { BlockDayPlan, TrainingBlockConfig } from '../../../types/powerliftingBlock';

const profile: UserProfile = {
  weightKg: 80,
  heightCm: 175,
  age: 28,
  sex: 'male',
  occupation: 'sedentary',
};

// Two lifts on two different days so the row-pairing logic (day index ×
// variation index) has more than one row to get right, plus an accessory so
// the trailing "Bài phụ trợ" block is exercised too.
const schedule: BlockDayPlan[] = [
  {
    dayOfWeek: 1, // Monday
    variations: [{ exercise: 'bench_press', variationId: 'bench_touch_and_go', role: 'main' }],
    accessories: [{ customName: 'Dumbbell row', sets: 3, reps: '10' }],
  },
  {
    dayOfWeek: 3, // Wednesday
    variations: [{ exercise: 'squat', variationId: 'squat_standard', role: 'main' }],
    accessories: [],
  },
];

const config: TrainingBlockConfig = {
  id: 'block-1',
  createdAt: Date.now(),
  weekStartDate: '2026-09-07', // a Monday
  progressiveWeeks: 2,
  hasDeload: true,
  focus: 'intensity',
  schedule,
  oneRepMax: { squat: 140, bench_press: 100 },
  isBeginnerEstimated: { squat: false, bench_press: false, deadlift: true },
  bodyWeightKg: 80,
  deficitModeEnabled: false,
};

describe('buildPlanCrosstab', () => {
  const plan = generateBlockPlan(config, profile);
  const { aoa, styledCells, colCount } = buildPlanCrosstab(plan, 'vi');

  it('sizes every row to 1 label column + 1 column per week', () => {
    expect(colCount).toBe(1 + plan.weeks.length); // 2 progressive + 1 deload = 3 weeks -> 4 columns
    expect(aoa.every((row) => row.length === colCount)).toBe(true);
  });

  it('puts the title in A1 and marks it tier 1 (bold+large)', () => {
    expect(aoa[0][0]).toContain('Intensity');
    expect(styledCells).toContainEqual({ sheet: 1, ref: 'A1', tier: 1 });
  });

  it('week-header row (row 3) labels each column and is marked tier 2', () => {
    const headerRow = aoa[2];
    expect(headerRow[0]).toBe('');
    expect(headerRow[1]).toBe('Tuần 1');
    expect(headerRow[2]).toBe('Tuần 2');
    expect(headerRow[3]).toBe('Deload'); // last week is the deload week
    for (let c = 1; c <= 3; c++) {
      expect(styledCells).toContainEqual({ sheet: 1, ref: utils.encode_cell({ r: 2, c }), tier: 2 });
    }
  });

  it('each lift gets a Planned row (filled) + a blank Actual row directly under it, both tier 3', () => {
    // Row 3 (0-based) = Planned Bench (first day/variation)
    const plannedBench = aoa[3];
    expect(plannedBench[0]).toContain('Kế hoạch:');
    expect(plannedBench[0]).toContain('Bench');
    expect(plannedBench[1]).toMatch(/^\d+x\d+ @ .+kg \(~\d+%\)$/);
    expect(styledCells).toContainEqual({ sheet: 1, ref: 'A4', tier: 3 });

    const actualBench = aoa[4];
    expect(actualBench[0]).toContain('Thực tế:');
    expect(actualBench.slice(1).every((v) => v === '')).toBe(true);
    expect(styledCells).toContainEqual({ sheet: 1, ref: 'A5', tier: 3 });

    // row 5 (index) is the spacer between lifts
    expect(aoa[5].every((v) => v === '')).toBe(true);
  });

  it('the deload week column shows a lighter prescription than the last progressive week for the same lift', () => {
    const plannedSquat = aoa.find((row) => typeof row[0] === 'string' && row[0].includes('Squat'));
    expect(plannedSquat).toBeDefined();
    // week columns: 1=W1, 2=W2(last progressive), 3=Deload
    const lastProgressiveCell = plannedSquat![2] as string;
    const deloadCell = plannedSquat![3] as string;
    const pct = (cell: string) => Number(cell.match(/~(\d+)%/)![1]);
    expect(pct(deloadCell)).toBeLessThan(pct(lastProgressiveCell));
  });

  it('lists accessories underneath the lift rows without inventing per-week columns', () => {
    const sectionIdx = aoa.findIndex((row) => row[0] === 'Bài phụ trợ');
    expect(sectionIdx).toBeGreaterThan(-1);
    const accessoryRow = aoa[sectionIdx + 1];
    expect(accessoryRow[0]).toBe('Thứ Hai'); // day label
    expect(accessoryRow[1]).toContain('Dumbbell row');
  });

  it('produces no accessories section when the block has none', () => {
    const noAccConfig: TrainingBlockConfig = {
      ...config,
      schedule: [{ ...schedule[1] }], // squat day only, no accessories
    };
    const noAccPlan = generateBlockPlan(noAccConfig, profile);
    const { aoa: noAccAoa } = buildPlanCrosstab(noAccPlan, 'vi');
    expect(noAccAoa.some((row) => row[0] === 'Bài phụ trợ')).toBe(false);
  });
});
