import { buildDailyTotals, buildFoodEntryRows } from '../excelSheets';
import { vi } from '../../../i18n/locales/vi';
import { en } from '../../../i18n/locales/en';
import type { FoodLogEntry, FoodItem } from '../../../types/food';
import type { ActivityLogEntry } from '../../../types/energy';
import type { BatteryReading } from '../../../types/battery';

const col = vi.export.columns;

function entry(overrides: Partial<FoodLogEntry>): FoodLogEntry {
  return {
    id: 'e1',
    timestamp: new Date('2026-07-01T08:00:00').getTime(),
    mealType: 'breakfast',
    foodId: 'rice',
    foodNameVi: 'Cơm trắng',
    grams: 150,
    energyKcal: 195,
    proteinG: 4,
    fatG: 0.5,
    carbG: 43,
    waterG: 100,
    mineralsMg: 10,
    ...overrides,
  };
}

function activityEntry(overrides: Partial<ActivityLogEntry>): ActivityLogEntry {
  return {
    id: 'a1',
    timestamp: new Date('2026-07-01T08:00:00').getTime(),
    steps: 3000,
    workouts: [],
    energyKcal: 150,
    satietyDrainKcal: 0,
    energyDayApplied: '2026-07-01',
    ...overrides,
  };
}

function energyReading(overrides: Partial<BatteryReading>): BatteryReading {
  return {
    date: '2026-07-01',
    batteryTypeId: 'energy',
    level: 0,
    capacity: 1800,
    ...overrides,
  };
}

// Sodium 80mg/100g -> salt 0.2g/100g (per100gValue's 2.5x sodium->salt rule).
const RICE_ITEM: FoodItem = {
  id: 'rice',
  nameVi: 'Cơm trắng',
  nameEn: 'White rice',
  category: 'grain',
  defaultServingG: 150,
  servingPresets: [],
  per100g: {
    energyKcal: 130,
    waterG: 68,
    proteinG: 2.7,
    fatG: 0.3,
    carbG: 28,
    fiberG: 2,
    sugarG: 0.2,
    calciumMg: 10,
    ironMg: 0.8,
    sodiumMg: 80,
    potassiumMg: 35,
    magnesiumMg: 12,
    zincMg: 0.5,
  },
  source: 'test',
  note: '',
};

function lookup(foodId: string): FoodItem | undefined {
  return foodId === 'rice' ? RICE_ITEM : undefined;
}

describe('buildDailyTotals', () => {
  it('sums macros per calendar day and sorts ascending by date', () => {
    const entries: FoodLogEntry[] = [
      entry({
        id: 'a',
        timestamp: new Date('2026-07-02T08:00:00').getTime(),
        energyKcal: 100,
        fatG: 1,
        carbG: 2,
        proteinG: 3,
      }),
      entry({
        id: 'b',
        timestamp: new Date('2026-07-01T08:00:00').getTime(),
        energyKcal: 200,
        fatG: 4,
        carbG: 5,
        proteinG: 6,
      }),
      entry({
        id: 'c',
        timestamp: new Date('2026-07-01T20:00:00').getTime(),
        energyKcal: 50.05,
        fatG: 0.05,
        carbG: 0.04,
        proteinG: 0.06,
      }),
    ];

    const rows = buildDailyTotals(entries, [], [], [], new Map(), 'vi');

    // 2 day rows + blank separator + disclaimer row.
    expect(rows).toHaveLength(4);
    // Ascending order: July 1 before July 2.
    expect(rows[0][col.date]).toBe('1-Jul-2026');
    expect(rows[1][col.date]).toBe('2-Jul-2026');

    // July 1 aggregates entries b + c (200 + 50.05 = 250.05, rounded to 1dp).
    expect(rows[0][col.calories]).toBeCloseTo(250.1, 5);
    expect(rows[0][col.fat]).toBeCloseTo(4.1, 5);
    expect(rows[0][col.carbs]).toBeCloseTo(5, 5);
    expect(rows[0][col.protein]).toBeCloseTo(6.1, 5);

    // July 2 has just entry a.
    expect(rows[1][col.calories]).toBe(100);
  });

  it('only includes days that actually have logged food (plus the trailing disclaimer)', () => {
    const entries: FoodLogEntry[] = [entry({ timestamp: new Date('2026-07-05T12:00:00').getTime() })];
    const rows = buildDailyTotals(entries, [], [], [], new Map(), 'vi');
    expect(rows).toHaveLength(3); // 1 day row + blank separator + disclaimer
    expect(rows[0][col.date]).toBe('5-Jul-2026');
  });

  it('appends a blank separator then a disclaimer row as the last 2 rows', () => {
    const entries: FoodLogEntry[] = [entry({ timestamp: new Date('2026-07-05T12:00:00').getTime() })];
    const rows = buildDailyTotals(entries, [], [], [], new Map(), 'vi');
    expect(rows[rows.length - 2]).toEqual({});
    expect(rows[rows.length - 1]).toEqual({ [col.date]: vi.assessment.disclaimer });
  });

  it('returns no rows (not even a disclaimer) when there are no food entries', () => {
    expect(buildDailyTotals([], [], [], [], new Map(), 'vi')).toEqual([]);
  });

  it('carries forward the most recent weight logged on or before the day', () => {
    const entries: FoodLogEntry[] = [
      entry({ timestamp: new Date('2026-07-03T08:00:00').getTime() }),
    ];
    const weights = [
      { timestamp: new Date('2026-07-01T09:00:00').getTime(), value: 70 },
      { timestamp: new Date('2026-06-25T09:00:00').getTime(), value: 68 },
    ];

    const rows = buildDailyTotals(entries, weights, [], [], new Map(), 'vi');
    expect(rows[0][col.weight]).toBe(70);
  });

  it('picks the latest same-day weight when multiple are logged that day', () => {
    const entries: FoodLogEntry[] = [
      entry({ timestamp: new Date('2026-07-03T08:00:00').getTime() }),
    ];
    const weights = [
      { timestamp: new Date('2026-07-03T07:00:00').getTime(), value: 70 },
      { timestamp: new Date('2026-07-03T20:00:00').getTime(), value: 71 },
    ];

    const rows = buildDailyTotals(entries, weights, [], [], new Map(), 'vi');
    expect(rows[0][col.weight]).toBe(71);
  });

  it('ignores weights logged after the day and leaves the cell blank when none exist yet', () => {
    const entries: FoodLogEntry[] = [
      entry({ timestamp: new Date('2026-07-01T08:00:00').getTime() }),
    ];
    const weights = [{ timestamp: new Date('2026-07-05T09:00:00').getTime(), value: 70 }];

    const rows = buildDailyTotals(entries, weights, [], [], new Map(), 'vi');
    expect(rows[0][col.weight]).toBe('');
  });

  it('sums that day\'s activity log kcal into Burned kcal, grouped by startAt over timestamp', () => {
    const entries: FoodLogEntry[] = [
      entry({ timestamp: new Date('2026-07-01T08:00:00').getTime() }),
    ];
    const activityLog: ActivityLogEntry[] = [
      // Logged just after midnight but the activity itself happened on 6/30 evening —
      // must be grouped under 6/30, not 7/1, and therefore NOT counted here.
      activityEntry({
        id: 'late-night',
        timestamp: new Date('2026-07-01T00:30:00').getTime(),
        startAt: new Date('2026-06-30T22:00:00').getTime(),
        energyKcal: 999,
      }),
      activityEntry({
        id: 'same-day',
        timestamp: new Date('2026-07-01T09:00:00').getTime(),
        energyKcal: 120,
      }),
    ];

    const rows = buildDailyTotals(entries, [], activityLog, [], new Map(), 'vi');
    expect(rows[0][col.burnedKcal]).toBe(120);
  });

  it('reads Estimated Energy Need from that day\'s energy battery capacity, blank when missing', () => {
    const entries: FoodLogEntry[] = [
      entry({ timestamp: new Date('2026-07-01T08:00:00').getTime(), energyKcal: 500 }),
      entry({
        id: 'e2',
        timestamp: new Date('2026-07-02T08:00:00').getTime(),
        energyKcal: 300,
      }),
    ];
    const energyReadings: BatteryReading[] = [
      energyReading({ date: '2026-07-01', capacity: 2000 }),
    ];

    const rows = buildDailyTotals(entries, [], [], energyReadings, new Map(), 'vi');
    expect(rows[0][col.estimatedEnergyNeed]).toBe(2000);
    expect(rows[0][col.energyBalance]).toBe(-1500); // 500 eaten - 2000 need
    expect(rows[1][col.estimatedEnergyNeed]).toBe('');
    expect(rows[1][col.energyBalance]).toBe('');
  });

  it('reports a calorie surplus as a positive balance', () => {
    const entries: FoodLogEntry[] = [
      entry({ timestamp: new Date('2026-07-01T08:00:00').getTime(), energyKcal: 2500 }),
    ];
    const energyReadings: BatteryReading[] = [energyReading({ date: '2026-07-01', capacity: 2000 })];

    const rows = buildDailyTotals(entries, [], [], energyReadings, new Map(), 'vi');
    expect(rows[0][col.energyBalance]).toBe(500);
  });

  it('prefers the Apple Health synced burned kcal over battery capacity for Estimated Energy Need + balance', () => {
    // Regression for the bug where Excel ignored the real Apple Health burn
    // and used the stale battery-capacity estimate instead, understating true
    // expenditure and showing a surplus where the real day was a deficit.
    const entries: FoodLogEntry[] = [
      entry({ timestamp: new Date('2026-07-01T08:00:00').getTime(), energyKcal: 2200 }),
    ];
    const energyReadings: BatteryReading[] = [energyReading({ date: '2026-07-01', capacity: 2000 })];
    const appleHealthBurned = new Map([['2026-07-01', 2800]]);

    const rows = buildDailyTotals(entries, [], [], energyReadings, appleHealthBurned, 'vi');
    expect(rows[0][col.estimatedEnergyNeed]).toBe(2800);
    expect(rows[0][col.energyBalance]).toBe(-600); // 2200 eaten - 2800 real burn = deficit
  });

  it('falls back to battery capacity when a day has no Apple Health sync', () => {
    const entries: FoodLogEntry[] = [
      entry({ timestamp: new Date('2026-07-01T08:00:00').getTime(), energyKcal: 2200 }),
    ];
    const energyReadings: BatteryReading[] = [energyReading({ date: '2026-07-01', capacity: 2000 })];
    const appleHealthBurned = new Map([['2026-07-02', 2800]]); // a different day only

    const rows = buildDailyTotals(entries, [], [], energyReadings, appleHealthBurned, 'vi');
    expect(rows[0][col.estimatedEnergyNeed]).toBe(2000);
    expect(rows[0][col.energyBalance]).toBe(200);
  });
});

describe('buildFoodEntryRows', () => {
  it('sorts entries ascending by timestamp and maps columns (Brand is always blank)', () => {
    const entries: FoodLogEntry[] = [
      entry({
        id: 'later',
        // Distinct, unresolvable foodId: proves this row falls back to its
        // OWN foodNameVi snapshot rather than resolving to RICE_ITEM's name
        // (which the 'earlier' row below shares foodId: 'rice' with).
        foodId: 'unknown-food',
        timestamp: new Date('2026-07-01T20:00:00').getTime(),
        foodNameVi: 'Phở bò',
        grams: 400,
        energyKcal: 350,
        fatG: 10,
        carbG: 40,
        proteinG: 20,
      }),
      entry({
        id: 'earlier',
        timestamp: new Date('2026-07-01T08:00:00').getTime(),
        foodNameVi: 'Cơm trắng',
        grams: 150,
        energyKcal: 195,
        fatG: 0.5,
        carbG: 43,
        proteinG: 4,
      }),
    ];

    const rows = buildFoodEntryRows(entries, lookup, 'vi');

    expect(rows).toHaveLength(2); // same day → no separator row
    expect(rows[0]).toEqual({
      [col.date]: '1-Jul-2026',
      [col.brand]: '',
      [col.food]: 'Cơm trắng',
      [col.qty]: '150 g',
      [col.calories]: 195,
      [col.fat]: 0.5,
      [col.carbs]: 43,
      [col.protein]: 4,
      // 150g = 1.5x the per-100g figures on RICE_ITEM.
      [col.sugar]: 0.3,
      [col.fiber]: 3,
      [col.iron]: 1.2,
      [col.salt]: 0.3,
    });
    expect((rows[1] as Record<string, unknown>)[col.food]).toBe('Phở bò');
  });

  it('leaves micronutrient columns blank when the food can\'t be looked up', () => {
    const entries: FoodLogEntry[] = [entry({ foodId: 'unknown-food' })];
    const rows = buildFoodEntryRows(entries, lookup, 'vi');
    expect(rows[0][col.sugar]).toBe('');
    expect(rows[0][col.fiber]).toBe('');
    expect(rows[0][col.iron]).toBe('');
    expect(rows[0][col.salt]).toBe('');
  });

  it('inserts a blank separator row between entries on different calendar days', () => {
    const entries: FoodLogEntry[] = [
      entry({ id: 'day1', timestamp: new Date('2026-07-01T08:00:00').getTime() }),
      entry({ id: 'day2', timestamp: new Date('2026-07-02T08:00:00').getTime() }),
    ];

    const rows = buildFoodEntryRows(entries, lookup, 'vi');

    expect(rows).toHaveLength(3);
    expect(rows[0][col.date]).toBe('1-Jul-2026');
    expect(rows[1]).toEqual({});
    expect(rows[2][col.date]).toBe('2-Jul-2026');
  });

  it('inserts one separator per day boundary across 3 days', () => {
    const entries: FoodLogEntry[] = [
      entry({ id: 'd1', timestamp: new Date('2026-07-01T08:00:00').getTime() }),
      entry({ id: 'd2', timestamp: new Date('2026-07-02T08:00:00').getTime() }),
      entry({ id: 'd3', timestamp: new Date('2026-07-03T08:00:00').getTime() }),
    ];

    const rows = buildFoodEntryRows(entries, lookup, 'vi');
    expect(rows).toHaveLength(5); // 3 entry rows + 2 separators
    expect(rows[1]).toEqual({});
    expect(rows[3]).toEqual({});
  });

  it('returns an empty array for no entries', () => {
    expect(buildFoodEntryRows([], lookup, 'vi')).toEqual([]);
  });

  it('uses the looked-up item\'s translated name for the export language, not the vi snapshot', () => {
    const entries: FoodLogEntry[] = [entry({ foodNameVi: 'stale snapshot' })];
    const rows = buildFoodEntryRows(entries, lookup, 'en');
    expect(rows[0][en.export.columns.food]).toBe('White rice');
  });

  it('falls back to the frozen foodNameVi snapshot when the food can\'t be looked up, even in a non-vi export', () => {
    const entries: FoodLogEntry[] = [
      entry({ foodId: 'unknown-food', foodNameVi: 'Món đã xoá' }),
    ];
    const rows = buildFoodEntryRows(entries, lookup, 'en');
    expect(rows[0][en.export.columns.food]).toBe('Món đã xoá');
  });
});
