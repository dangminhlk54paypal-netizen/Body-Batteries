import type { FoodItem, Nutrition, PortionUnit } from '../../types/food';

// Row shape of the `custom_foods` table (see src/data/db/schema.ts).
export interface CustomFoodRow {
  id: string;
  name_vi: string;
  name_en: string;
  category: string;
  default_serving_g: number;
  energy_kcal: number;
  water_g: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  fiber_g: number;
  sugar_g: number;
  calcium_mg: number;
  iron_mg: number;
  sodium_mg: number;
  potassium_mg: number;
  magnesium_mg: number;
  zinc_mg: number;
  epa_mg: number | null;
  dha_mg: number | null;
  portion_unit: string | null;
  serving_weight_g: number | null;
  created_at: number;
}

// Pure row -> FoodItem mapping, kept in its own DB-free module so it's
// directly unit-testable (importing customFoodsRepository.ts pulls in
// expo-sqlite, which can't load under plain Jest — see
// __tests__/customFoodMapper.test.ts). Custom foods have no serving presets
// / German name / source note yet — defaulted here.
export function rowToCustomFoodItem(r: CustomFoodRow): FoodItem {
  const per100g: Nutrition = {
    energyKcal: r.energy_kcal,
    waterG: r.water_g,
    proteinG: r.protein_g,
    fatG: r.fat_g,
    carbG: r.carb_g,
    fiberG: r.fiber_g,
    sugarG: r.sugar_g,
    calciumMg: r.calcium_mg,
    ironMg: r.iron_mg,
    sodiumMg: r.sodium_mg,
    potassiumMg: r.potassium_mg,
    magnesiumMg: r.magnesium_mg,
    zincMg: r.zinc_mg,
    epaMg: r.epa_mg ?? undefined,
    dhaMg: r.dha_mg ?? undefined,
  };
  return {
    id: r.id,
    nameVi: r.name_vi,
    nameEn: r.name_en,
    nameDe: '',
    category: r.category,
    defaultServingG: r.default_serving_g,
    servingPresets: [],
    per100g,
    source: 'custom',
    note: '',
    portionUnit: (r.portion_unit as PortionUnit | null) ?? undefined,
    servingWeightG: r.serving_weight_g ?? undefined,
  };
}
