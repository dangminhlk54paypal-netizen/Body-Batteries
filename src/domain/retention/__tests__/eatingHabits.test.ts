import { summarizeEatingDays, UNKNOWN_CATEGORY } from '../eatingHabits';
import type { FoodItem, FoodLogEntry } from '../../../types/food';

const at = (date: string, h: number) => new Date(`${date}T${String(h).padStart(2, '0')}:00:00`).getTime();

function entry(id: string, foodId: string, timestamp: number, kcal: number, mealType: FoodLogEntry['mealType']): FoodLogEntry {
  return {
    id,
    timestamp,
    mealType,
    foodId,
    foodNameVi: id,
    grams: 100,
    energyKcal: kcal,
    proteinG: 10,
    fatG: 5,
    carbG: 20,
    waterG: 0,
    mineralsMg: 0,
  };
}

const catalog: Record<string, Partial<FoodItem>> = { rice: { category: 'grain' }, salad: { category: 'vegetable' } };
const lookup = (id: string) => catalog[id] as FoodItem | undefined;

it('one row per calendar day, oldest first, with kcal per food group', () => {
  const days = summarizeEatingDays(
    [
      entry('b', 'salad', at('2026-03-02', 12), 80, 'lunch'),
      entry('a', 'rice', at('2026-03-01', 7), 200, 'breakfast'),
      entry('c', 'rice', at('2026-03-02', 19), 250, 'dinner'),
      entry('d', 'gone', at('2026-03-02', 20), 100.04, 'dinner'),
    ],
    lookup
  );
  expect(days.map((d) => d.date)).toEqual(['2026-03-01', '2026-03-02']);
  expect(days[1]).toEqual({
    date: '2026-03-02',
    kcal: 430,
    proteinG: 30,
    carbG: 60,
    fatG: 15,
    foodCount: 3,
    mealCount: 2,
    categoryKcal: { vegetable: 80, grain: 250, [UNKNOWN_CATEGORY]: 100 },
  });
});

it('no foods → no rows', () => {
  expect(summarizeEatingDays([], lookup)).toEqual([]);
});
