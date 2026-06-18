import { nutritionForGrams, mealTypeForHour } from '../foodNutrition';
import type { FoodItem } from '../../../types/food';

const rice: FoodItem = {
  id: 'rice_white_cooked',
  nameVi: 'Cơm trắng',
  nameEn: 'White rice, cooked',
  category: 'grain',
  defaultServingG: 150,
  servingPresets: [{ label: 'chén', grams: 150 }],
  per100g: {
    energyKcal: 130,
    waterG: 68.4,
    proteinG: 2.7,
    fatG: 0.3,
    carbG: 28.2,
    fiberG: 0.4,
    sugarG: 0.1,
    calciumMg: 10,
    ironMg: 0.2,
    sodiumMg: 1,
    potassiumMg: 35,
    magnesiumMg: 12,
    zincMg: 0.5,
  },
  source: 'USDA',
  note: '',
};

describe('nutritionForGrams', () => {
  it('scales per-100g values to the portion', () => {
    const n = nutritionForGrams(rice, 150); // 1.5×
    expect(n.energyKcal).toBe(195); // 130 * 1.5
    expect(n.proteinG).toBe(4.1); // 2.7 * 1.5 = 4.05 → 4.1
    expect(n.carbG).toBe(42.3); // 28.2 * 1.5
    expect(n.waterG).toBe(102.6);
  });

  it('rolls minerals into one mg figure', () => {
    // (10 + 0.2 + 1 + 35 + 12 + 0.5) = 58.7 per 100g → ×1.5 = 88.05 → 88
    expect(nutritionForGrams(rice, 150).mineralsMg).toBe(88);
  });

  it('is zero for a zero portion and never negative', () => {
    expect(nutritionForGrams(rice, 0).energyKcal).toBe(0);
    expect(nutritionForGrams(rice, -50).energyKcal).toBe(0);
  });
});

describe('mealTypeForHour (default windows)', () => {
  it('classifies the three main meals', () => {
    expect(mealTypeForHour(7)).toBe('breakfast'); // 5–10
    expect(mealTypeForHour(12)).toBe('lunch'); // 10–14
    expect(mealTypeForHour(19)).toBe('dinner'); // 17–21
  });

  it('treats out-of-window times as snack', () => {
    expect(mealTypeForHour(15)).toBe('snack'); // afternoon gap
    expect(mealTypeForHour(23)).toBe('snack'); // late night
    expect(mealTypeForHour(4)).toBe('snack'); // pre-dawn
  });

  it('uses half-open windows (end hour belongs to the next slot)', () => {
    expect(mealTypeForHour(10)).toBe('lunch'); // breakfast ends at 10
    expect(mealTypeForHour(14)).toBe('snack'); // lunch ends at 14
    expect(mealTypeForHour(21)).toBe('snack'); // dinner ends at 21
  });
});
