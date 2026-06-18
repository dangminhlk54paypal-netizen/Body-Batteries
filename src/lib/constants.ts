import type { BatteryType } from '../types/battery';
import type { MealType } from '../types/food';

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

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Bữa sáng',
  lunch: 'Bữa trưa',
  dinner: 'Bữa tối',
  snack: 'Bữa phụ',
};

// Vietnamese labels for the food-database categories (CSV `category` column).
// Falls back to the raw category string for anything not listed here.
export const FOOD_CATEGORY_LABELS: Record<string, string> = {
  grain: 'Tinh bột',
  meat: 'Thịt',
  fish: 'Cá & hải sản',
  egg_dairy: 'Trứng & sữa',
  legume_nut: 'Đậu & hạt',
  vegetable: 'Rau củ',
  fruit: 'Trái cây',
  fat_sugar: 'Dầu mỡ & đường',
  dish: 'Món chế biến',
};

export const LOW_BATTERY_THRESHOLD = 0.2; // 20% — trigger warning below this

export const DATA_RETENTION_DAYS = 7;

export const DRAIN_TICK_INTERVAL_MS = 30 * 60 * 1000; // every 30 min

export const BACKGROUND_TASK_NAME = 'BATTERY_DRAIN_TASK';
export const DAILY_RESET_TASK_NAME = 'DAILY_RESET_TASK';
