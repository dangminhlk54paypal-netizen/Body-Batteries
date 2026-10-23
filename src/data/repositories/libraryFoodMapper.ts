import type { FoodItem, Nutrition } from '../../types/food';
import type { LibraryMappingConfig, LibrarySource } from '../../types/foodLibrary';
import { expandUmlauts, normalize, wordsOf } from '../../domain/food/searchNormalize';

// Row shapes of library_sources / library_foods (src/data/db/schema.ts) and
// their pure mappings, kept DB-free so they are unit-testable under plain
// Jest (libraryFoodsRepository.ts pulls in expo-sqlite) — same split as
// customFoodMapper.ts.

export interface LibrarySourceRow {
  id: string;
  name: string;
  file_name: string | null;
  enabled: number;
  food_count: number;
  mapping: string | null;
  created_at: number;
  updated_at: number;
}

export interface LibraryFoodRow {
  id: string;
  source_id: string;
  name_vi: string;
  name_en: string | null;
  name_de: string | null;
  name_norm: string;
  category: string | null;
  default_serving_g: number | null;
  energy_kcal: number | null;
  water_g: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  calcium_mg: number | null;
  iron_mg: number | null;
  sodium_mg: number | null;
  potassium_mg: number | null;
  magnesium_mg: number | null;
  zinc_mg: number | null;
  epa_mg: number | null;
  dha_mg: number | null;
}

function parseMapping(json: string | null): LibraryMappingConfig | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as LibraryMappingConfig;
  } catch {
    return null;
  }
}

export function rowToLibrarySource(r: LibrarySourceRow): LibrarySource {
  return {
    id: r.id,
    name: r.name,
    fileName: r.file_name ?? '',
    enabled: r.enabled === 1,
    foodCount: r.food_count,
    mapping: parseMapping(r.mapping),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function rowToLibraryFood(r: LibraryFoodRow): FoodItem {
  const per100g: Nutrition = {
    energyKcal: r.energy_kcal ?? 0,
    waterG: r.water_g ?? 0,
    proteinG: r.protein_g ?? 0,
    fatG: r.fat_g ?? 0,
    carbG: r.carb_g ?? 0,
    fiberG: r.fiber_g ?? 0,
    sugarG: r.sugar_g ?? 0,
    calciumMg: r.calcium_mg ?? 0,
    ironMg: r.iron_mg ?? 0,
    sodiumMg: r.sodium_mg ?? 0,
    potassiumMg: r.potassium_mg ?? 0,
    magnesiumMg: r.magnesium_mg ?? 0,
    zincMg: r.zinc_mg ?? 0,
    epaMg: r.epa_mg ?? undefined,
    dhaMg: r.dha_mg ?? undefined,
  };
  return {
    id: r.id,
    nameVi: r.name_vi,
    nameEn: r.name_en ?? '',
    nameDe: r.name_de ?? '',
    category: r.category ?? '',
    defaultServingG: r.default_serving_g && r.default_serving_g > 0 ? r.default_serving_g : 100,
    servingPresets: [],
    per100g,
    source: 'library',
    note: '',
  };
}

// The `name_norm` column: every name of the food folded the way the search
// query is folded (searchNormalize.ts), German also in its umlaut-expanded
// spelling, plus the category — one space-separated string the SQL search
// matches each typed word against.
export function librarySearchText(item: Pick<FoodItem, 'nameVi' | 'nameEn' | 'nameDe' | 'category'>): string {
  const parts = [
    normalize(item.nameVi),
    normalize(item.nameEn),
    normalize(item.nameDe ?? ''),
    expandUmlauts(item.nameDe ?? ''),
    normalize(item.category),
  ];
  return [...new Set(parts.flatMap(wordsOf))].join(' ');
}

// Bind values for one INSERT OR REPLACE INTO library_foods, in column order
// (see LIBRARY_FOOD_COLUMNS in libraryFoodsRepository.ts).
export function libraryFoodBindValues(item: FoodItem, sourceId: string): (string | number | null)[] {
  const n = item.per100g;
  return [
    item.id,
    sourceId,
    item.nameVi,
    item.nameEn || null,
    item.nameDe || null,
    librarySearchText(item),
    item.category || null,
    item.defaultServingG,
    n.energyKcal,
    n.waterG,
    n.proteinG,
    n.fatG,
    n.carbG,
    n.fiberG,
    n.sugarG,
    n.calciumMg,
    n.ironMg,
    n.sodiumMg,
    n.potassiumMg,
    n.magnesiumMg,
    n.zincMg,
    n.epaMg ?? null,
    n.dhaMg ?? null,
  ];
}
