import { utils } from 'xlsx';
import { buildPlanCrosstab } from '../trainingBlockPrintSheet';
import { generateBlockPlan } from '../../../domain/energy/blockEngine';
import {
  pauseAtWeek,
  setDayAccessories,
  setDaySkipped,
  setVariationSets,
  setWeekSkipped,
} from '../../../domain/energy/blockPlanEdits';
import { setVariationRpe } from '../../../domain/energy/rpeCoach';
import { formatSetSequence } from '../../../domain/training/trainingLogFormatter';
import { DEFAULT_TRAINING_LOG_FORMAT } from '../../../types/trainingLog';
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

  it('row 2 names whose plan it is when a nickname is set, else stays blank', () => {
    expect(aoa[1].every((cell) => cell === '')).toBe(true);
    const { aoa: named } = buildPlanCrosstab(plan, 'vi', 'Minh');
    expect(named[1][0]).toBe('Người tập: Minh');
    expect(named[2]).toEqual(aoa[2]); // header row unchanged
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
    // The owner's own sheet: "Planned TnG Bench (TM = 100)" / "Actual TnG Bench".
    expect(plannedBench[0]).toBe('Planned TnG Bench (TM = 100)');
    expect(plannedBench[1]).toMatch(/^(?:[\d.]+ \+ )?\d+x\d+x[\d.]+ \(~\d+%\)$/); // "92.5 + 4x5x75 (~75%)" — the log's notation, prime first
    expect(plannedBench[1]).toBe(`${formatSetSequence(plan.weeks[0].days[0].variations[0].sets, DEFAULT_TRAINING_LOG_FORMAT, 'vi')} (~${plan.weeks[0].days[0].variations[0].pct1rm}%)`);
    expect(styledCells).toContainEqual({ sheet: 1, ref: 'A4', tier: 3 });

    const actualBench = aoa[4];
    expect(actualBench[0]).toBe('Actual TnG Bench');
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

  it("prints the user's own plan when they edited a week (every set, not just the first)", () => {
    const edited = setVariationSets(
      plan,
      { weekIndex: 1, dayIndex: 0, variationIndex: 0 },
      [
        { kind: 'working', weightKg: 110, reps: 1 },
        ...Array.from({ length: 5 }, () => ({ kind: 'working' as const, weightKg: 95, reps: 5 })),
      ],
      175
    );
    const { aoa: editedAoa } = buildPlanCrosstab(edited, 'vi');
    expect(editedAoa[3][2]).toBe('110 5x5x95 (~110%)');
  });

  it('prints a skipped week and a dropped day as "Nghỉ", not as training', () => {
    const off = setDaySkipped(setWeekSkipped(plan, 1, true), { weekIndex: 0, dayIndex: 1 }, true);
    const { aoa: offAoa } = buildPlanCrosstab(off, 'vi');
    expect(offAoa[2][2]).toBe('Tuần 2 (Nghỉ)');
    const benchRow = offAoa.find((row) => String(row[0]).startsWith('Planned '))!;
    expect(benchRow[2]).toBe('Nghỉ'); // the whole of week 2
    expect(benchRow[1]).not.toBe('Nghỉ'); // Monday of week 1 still trains
    const squatRow = offAoa.filter((row) => String(row[0]).startsWith('Planned '))[1];
    expect(squatRow[1]).toBe('Nghỉ'); // Wednesday of week 1 dropped
  });

  it('prints accessories per week, including ones added for later weeks only', () => {
    const added = setDayAccessories(
      plan,
      { weekIndex: 1, dayIndex: 0 },
      [...plan.weeks[1].days[0].accessories, { customName: 'Face pull', sets: 3, reps: '15' }],
      true
    );
    const { aoa: accAoa } = buildPlanCrosstab(added, 'vi');
    const face = accAoa.find((row) => String(row[1]).includes('Face pull') || String(row[2]).includes('Face pull'))!;
    expect(face[0]).toBe('Thứ Hai');
    expect(face[1]).toBe(''); // week 1 did not have it
    expect(face[2]).toContain('Face pull');
    expect(face[3]).toContain('Face pull');
  });

  it('lists the weeks off put into the block', () => {
    const result = pauseAtWeek(plan, 1);
    if (!result.ok) throw new Error(result.error);
    const { aoa: pausedAoa } = buildPlanCrosstab(result.plan, 'vi');
    const idx = pausedAoa.findIndex((row) => row[0] === 'Tuần nghỉ chèn thêm');
    expect(idx).toBeGreaterThan(-1);
    expect(pausedAoa[idx + 1][0]).toContain(' - ');
  });

  it("prints a linear block's own Training Max in the row label", () => {
    const linear = generateBlockPlan(
      { ...config, focus: 'linear', trainingMax: { bench_touch_and_go: 122.5, squat_standard: 200 } },
      profile
    );
    const { aoa: tmAoa } = buildPlanCrosstab(linear, 'vi');
    expect(tmAoa[3][0]).toBe('Planned TnG Bench (TM = 122,5)');
    expect(tmAoa.some((row) => row[0] === 'Planned Squat (TM = 200)')).toBe(true);
  });

  it('the Actual row carries the RPE the lifter rated', () => {
    const rated = setVariationRpe(plan, { weekIndex: 1, dayIndex: 0, variationIndex: 0 }, 8.5);
    const { aoa: ratedAoa } = buildPlanCrosstab(rated, 'vi');
    expect(ratedAoa[4]).toEqual(['Actual TnG Bench', '', 'RPE 8,5', '']);
  });
});
