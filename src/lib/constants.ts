import type { BatteryType } from '../types/battery';
import type { MealType } from '../types/food';
import { translate } from '../i18n/translate';
import type { Language } from '../i18n/types';

export const DEFAULT_BATTERIES: BatteryType[] = [
  {
    id: 'protein',
    name: 'Protein',
    unit: 'g',
    defaultCapacity: 120,
    color: '#FF6B6B',
    icon: 'egg',
    isActive: true,
  },
  {
    id: 'carbs',
    name: 'Carbs',
    unit: 'g',
    defaultCapacity: 250,
    color: '#FFD93D',
    icon: 'grain',
    isActive: true,
  },
  {
    id: 'water',
    name: 'Nước',
    unit: 'ml',
    defaultCapacity: 2500,
    color: '#4ECDC4',
    icon: 'water-drop',
    isActive: true,
  },
  {
    id: 'minerals',
    name: 'Khoáng chất',
    unit: 'mg',
    defaultCapacity: 500,
    color: '#A29BFE',
    icon: 'flash',
    isActive: true,
  },
  {
    id: 'sleep',
    name: 'Giấc ngủ',
    unit: 'h',
    defaultCapacity: 8,
    color: '#6C5CE7',
    icon: 'moon',
    isActive: true,
  },
  {
    id: 'movement',
    name: 'Vận động',
    unit: 'steps',
    defaultCapacity: 8000,
    color: '#00B894',
    icon: 'walk',
    isActive: true,
  },
];

// The calorie-balance battery (Hướng B). It is NOT one of the 6 nutrient
// sub-batteries — it is the headline "energy" battery whose capacity comes from
// the user's metabolism (TDEE) and which charges by eating / drains by burning.
export const ENERGY_BATTERY: BatteryType = {
  id: 'energy',
  name: 'Năng lượng',
  unit: 'kcal',
  defaultCapacity: 2000, // placeholder; real capacity comes from the user profile
  color: '#00B894',
  icon: 'bolt',
  isActive: true,
};

// Display name for a battery type, following the current app language.
// DEFAULT_BATTERIES/ENERGY_BATTERY.name above is only the seed value written
// to SQLite `battery_types.name` at first install — display always goes
// through this lookup (keyed by the stable `id`) instead of reading that
// column, so the label follows a language switch without a DB migration.
export function batteryTypeName(id: BatteryType['id'], language: Language): string {
  return translate(language, `batteries.${id}.name`);
}

// Each gram of protein or carbohydrate provides ~4 kcal (Atwater factors).
// Used to auto-charge the energy battery when those nutrients are logged.
export const KCAL_PER_GRAM: Partial<Record<BatteryType['id'], number>> = {
  protein: 4,
  carbs: 4,
};

// Default meal-time windows (local hour, [start, end)). A logged food's meal
// type is inferred from its eating time; anything outside these windows is a
// snack. v1: hard-coded — a "sửa khung giờ" form in Settings comes later.
export interface MealWindow {
  startHour: number;
  endHour: number;
}
export const DEFAULT_MEAL_WINDOWS: Record<'breakfast' | 'lunch' | 'dinner', MealWindow> = {
  breakfast: { startHour: 5, endHour: 10 },
  lunch: { startHour: 10, endHour: 14 },
  dinner: { startHour: 17, endHour: 21 },
};

export function mealLabel(meal: MealType, language: Language): string {
  return translate(language, `meals.${meal}`);
}

const FOOD_CATEGORY_IDS = new Set([
  'grain',
  'meat',
  'fish',
  'egg_dairy',
  'legume_nut',
  'vegetable',
  'fruit',
  'fat_sugar',
  'dish',
  'drink',
  'supplement',
  'snack',
]);

// Label for a food-database category (CSV `category` column), following the
// current app language. Falls back to the raw category string for anything
// not in the known set.
export function foodCategoryLabel(category: string, language: Language): string {
  if (!FOOD_CATEGORY_IDS.has(category)) return category;
  return translate(language, `foodCategories.${category}`);
}

export const LOW_BATTERY_THRESHOLD = 0.2; // 20% — trigger warning below this

// ~1 month of history so the monthly Excel export always has a full previous
// calendar month to write before old data is (optionally) cleaned up.
export const DATA_RETENTION_DAYS = 35;

// How far back the user can BACKFILL (log a food/activity entry for a past
// day) — a much tighter window than DATA_RETENTION_DAYS above, which governs
// how long already-logged data is kept, not how far back new entries may be
// entered. user yêu cầu 2026-07-17: chỉ bù tối đa 3 ngày.
export const BACKFILL_MAX_DAYS_BACK = 3;

// How far back a manually-logged weight entry can be corrected (fixing a
// mistyped value) — separate from BACKFILL_MAX_DAYS_BACK above since this
// gates EDITING an already-logged entry, not backfilling a new one.
export const WEIGHT_EDIT_MAX_DAYS_BACK = 3;

export const DRAIN_TICK_INTERVAL_MS = 30 * 60 * 1000; // every 30 min

export const BACKGROUND_TASK_NAME = 'BATTERY_DRAIN_TASK';
export const DAILY_RESET_TASK_NAME = 'DAILY_RESET_TASK';
