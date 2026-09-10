import { rowToPlan } from '../trainingBlockMapper';
import type { TrainingBlockRow } from '../trainingBlockMapper';

// Pure row <-> GeneratedBlockPlan mapping — no DB needed.
describe('rowToPlan', () => {
  function makeRow(configOverrides: Record<string, unknown>): TrainingBlockRow {
    return {
      id: 'block_1',
      created_at: 1700000000000,
      progressive_weeks: 3,
      has_deload: 1,
      focus: 'normal',
      body_weight_kg: 80,
      deficit_mode_enabled: 0,
      is_active: 1,
      config: JSON.stringify({
        id: 'block_1',
        createdAt: 1700000000000,
        progressiveWeeks: 3,
        hasDeload: true,
        focus: 'normal',
        schedule: [],
        oneRepMax: {},
        isBeginnerEstimated: {},
        bodyWeightKg: 80,
        deficitModeEnabled: false,
        ...configOverrides,
      }),
      weeks: JSON.stringify([{ weekNumber: 1, isDeload: false, days: [], totalKcal: 0, weeklyDeficitTargetKcal: null, startDate: '2026-08-24', endDate: '2026-08-30' }]),
    };
  }

  it('keeps weekStartDate as-is when already present', () => {
    const plan = rowToPlan(makeRow({ weekStartDate: '2026-09-01' }));
    expect(plan.config.weekStartDate).toBe('2026-09-01');
  });

  it('backfills weekStartDate from the first resolved week when missing (blocks created before Session 27)', () => {
    const plan = rowToPlan(makeRow({}));
    expect(plan.config.weekStartDate).toBe('2026-08-24');
  });

  it('falls back to today when neither weekStartDate nor a resolved week exist', () => {
    const row = makeRow({});
    row.weeks = JSON.stringify([]);
    const plan = rowToPlan(row);
    expect(typeof plan.config.weekStartDate).toBe('string');
    expect(plan.config.weekStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
