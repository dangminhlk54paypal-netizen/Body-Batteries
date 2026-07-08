import { buildDailyTotals, buildFoodEntryRows } from '../excelSheets';
import type { FoodLogEntry } from '../../../types/food';

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

    const rows = buildDailyTotals(entries, []);

    expect(rows).toHaveLength(2);
    // Ascending order: July 1 before July 2.
    expect(rows[0].Date).toBe('1-Jul-2026');
    expect(rows[1].Date).toBe('2-Jul-2026');

    // July 1 aggregates entries b + c (200 + 50.05 = 250.05, rounded to 1dp).
    expect(rows[0]['Calories (kcal)']).toBeCloseTo(250.1, 5);
    expect(rows[0]['Fat (g)']).toBeCloseTo(4.1, 5);
    expect(rows[0]['Carbs (g)']).toBeCloseTo(5, 5);
    expect(rows[0]['Protein (g)']).toBeCloseTo(6.1, 5);

    // July 2 has just entry a.
    expect(rows[1]['Calories (kcal)']).toBe(100);
  });

  it('only includes days that actually have logged food', () => {
    const entries: FoodLogEntry[] = [entry({ timestamp: new Date('2026-07-05T12:00:00').getTime() })];
    const rows = buildDailyTotals(entries, []);
    expect(rows).toHaveLength(1);
    expect(rows[0].Date).toBe('5-Jul-2026');
  });

  it('carries forward the most recent weight logged on or before the day', () => {
    const entries: FoodLogEntry[] = [
      entry({ timestamp: new Date('2026-07-03T08:00:00').getTime() }),
    ];
    const weights = [
      { timestamp: new Date('2026-07-01T09:00:00').getTime(), value: 70 },
      { timestamp: new Date('2026-06-25T09:00:00').getTime(), value: 68 },
    ];

    const rows = buildDailyTotals(entries, weights);
    expect(rows[0]['Weight (kg)']).toBe(70);
  });

  it('picks the latest same-day weight when multiple are logged that day', () => {
    const entries: FoodLogEntry[] = [
      entry({ timestamp: new Date('2026-07-03T08:00:00').getTime() }),
    ];
    const weights = [
      { timestamp: new Date('2026-07-03T07:00:00').getTime(), value: 70 },
      { timestamp: new Date('2026-07-03T20:00:00').getTime(), value: 71 },
    ];

    const rows = buildDailyTotals(entries, weights);
    expect(rows[0]['Weight (kg)']).toBe(71);
  });

  it('ignores weights logged after the day and leaves the cell blank when none exist yet', () => {
    const entries: FoodLogEntry[] = [
      entry({ timestamp: new Date('2026-07-01T08:00:00').getTime() }),
    ];
    const weights = [{ timestamp: new Date('2026-07-05T09:00:00').getTime(), value: 70 }];

    const rows = buildDailyTotals(entries, weights);
    expect(rows[0]['Weight (kg)']).toBe('');
  });
});

describe('buildFoodEntryRows', () => {
  it('sorts entries ascending by timestamp and maps columns (Brand is always blank)', () => {
    const entries: FoodLogEntry[] = [
      entry({
        id: 'later',
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

    const rows = buildFoodEntryRows(entries);

    expect(rows).toHaveLength(2); // same day → no separator row
    expect(rows[0]).toEqual({
      Date: '1-Jul-2026',
      Brand: '',
      Food: 'Cơm trắng',
      Qty: '150 g',
      'Calories (kcal)': 195,
      'Fat (g)': 0.5,
      'Carbs (g)': 43,
      'Protein (g)': 4,
    });
    expect(rows[1].Food).toBe('Phở bò');
  });

  it('inserts a blank separator row between entries on different calendar days', () => {
    const entries: FoodLogEntry[] = [
      entry({ id: 'day1', timestamp: new Date('2026-07-01T08:00:00').getTime() }),
      entry({ id: 'day2', timestamp: new Date('2026-07-02T08:00:00').getTime() }),
    ];

    const rows = buildFoodEntryRows(entries);

    expect(rows).toHaveLength(3);
    expect(rows[0].Date).toBe('1-Jul-2026');
    expect(rows[1]).toEqual({});
    expect(rows[2].Date).toBe('2-Jul-2026');
  });

  it('inserts one separator per day boundary across 3 days', () => {
    const entries: FoodLogEntry[] = [
      entry({ id: 'd1', timestamp: new Date('2026-07-01T08:00:00').getTime() }),
      entry({ id: 'd2', timestamp: new Date('2026-07-02T08:00:00').getTime() }),
      entry({ id: 'd3', timestamp: new Date('2026-07-03T08:00:00').getTime() }),
    ];

    const rows = buildFoodEntryRows(entries);
    expect(rows).toHaveLength(5); // 3 entry rows + 2 separators
    expect(rows[1]).toEqual({});
    expect(rows[3]).toEqual({});
  });

  it('returns an empty array for no entries', () => {
    expect(buildFoodEntryRows([])).toEqual([]);
  });
});
