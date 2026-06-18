import { summarizeFoodLog } from '../foodLogSummary';
import type { FoodLogEntry } from '../../../types/food';

function entry(over: Partial<FoodLogEntry>): FoodLogEntry {
  return {
    id: 'x',
    timestamp: 0,
    mealType: 'snack',
    foodId: 'f',
    foodNameVi: 'Món',
    grams: 100,
    energyKcal: 0,
    proteinG: 0,
    fatG: 0,
    carbG: 0,
    waterG: 0,
    mineralsMg: 0,
    ...over,
  };
}

describe('summarizeFoodLog', () => {
  it('is empty for no entries', () => {
    const s = summarizeFoodLog([]);
    expect(s.totalKcal).toBe(0);
    expect(s.groups).toEqual([]);
  });

  it('sums daily totals across meals', () => {
    const s = summarizeFoodLog([
      entry({ mealType: 'breakfast', energyKcal: 300, proteinG: 10, carbG: 40, fatG: 5 }),
      entry({ mealType: 'lunch', energyKcal: 600, proteinG: 30, carbG: 70, fatG: 20 }),
    ]);
    expect(s.totalKcal).toBe(900);
    expect(s.totalProteinG).toBe(40);
    expect(s.totalCarbG).toBe(110);
    expect(s.totalFatG).toBe(25);
  });

  it('groups by meal in canonical order, skipping empty meals', () => {
    const s = summarizeFoodLog([
      entry({ id: 'a', mealType: 'dinner', energyKcal: 500 }),
      entry({ id: 'b', mealType: 'breakfast', energyKcal: 200 }),
    ]);
    expect(s.groups.map((g) => g.mealType)).toEqual(['breakfast', 'dinner']);
    expect(s.groups[0].totalKcal).toBe(200);
    expect(s.groups[1].totalKcal).toBe(500);
  });

  it('orders entries within a meal chronologically', () => {
    const s = summarizeFoodLog([
      entry({ id: 'late', mealType: 'lunch', timestamp: 200 }),
      entry({ id: 'early', mealType: 'lunch', timestamp: 100 }),
    ]);
    expect(s.groups[0].entries.map((e) => e.id)).toEqual(['early', 'late']);
  });
});
