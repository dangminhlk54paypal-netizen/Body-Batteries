import type { FoodItem, FoodLogEntry } from '../../types/food';

// Pure data for NutritionDetailSheet's read-only breakdown table. No I/O,
// no formatting beyond the Vietnamese label text — that text IS the row's
// content, not view logic, so it lives here rather than in the component.
export interface NutritionDetailRow {
  label: string;
  value: number;
  unit: string;
}

// Round to one decimal place (display-friendly, avoids float noise like 8.400001).
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Appends a micronutrient row unless it rounds to zero — keeps the sheet
// compact for foods that don't meaningfully contribute a given micro (e.g.
// grilled salmon's sugar/fiber, or plain rice's EPA/DHA).
function pushIfNonZero(rows: NutritionDetailRow[], label: string, rawValue: number, unit: string) {
  const value = round1(rawValue);
  if (value > 0) rows.push({ label, value, unit });
}

// Full breakdown when the FoodItem is still resolvable in the catalog.
// kcal/4 macros/water come from the entry's OWN snapshot — the values that
// were actually charged to the batteries at log time — never recomputed from
// item.per100g, which the user may have edited (override/custom-food form)
// since logging; history must not be rewritten by later catalog edits (QA
// B1, same rule as everywhere else the snapshot exists for). Only the finer
// micros (fiber/sugar/individual minerals/EPA+DHA), which the snapshot
// doesn't carry (it rolls minerals into one coarse mineralsMg figure), are
// scaled (per-100g * grams/100) from the item's current per100g.
function buildFromItem(entry: FoodLogEntry, item: FoodItem): NutritionDetailRow[] {
  const factor = Math.max(0, entry.grams) / 100;
  const p = item.per100g;

  // kcal + the 4 macros + water always show, even when a value is 0 (e.g.
  // Carbs for a pure-protein food) — only the finer micros below are
  // compacted away when absent.
  const rows: NutritionDetailRow[] = [
    { label: 'Năng lượng', value: round1(entry.energyKcal), unit: 'kcal' },
    { label: 'Đạm', value: round1(entry.proteinG), unit: 'g' },
    { label: 'Béo', value: round1(entry.fatG), unit: 'g' },
    { label: 'Carbs', value: round1(entry.carbG), unit: 'g' },
    { label: 'Nước', value: round1(entry.waterG), unit: 'g' },
  ];

  pushIfNonZero(rows, 'Chất xơ', p.fiberG * factor, 'g');
  pushIfNonZero(rows, 'Đường', p.sugarG * factor, 'g');
  pushIfNonZero(rows, 'Canxi', p.calciumMg * factor, 'mg');
  pushIfNonZero(rows, 'Sắt', p.ironMg * factor, 'mg');
  pushIfNonZero(rows, 'Natri', p.sodiumMg * factor, 'mg');
  pushIfNonZero(rows, 'Kali', p.potassiumMg * factor, 'mg');
  pushIfNonZero(rows, 'Magiê', p.magnesiumMg * factor, 'mg');
  pushIfNonZero(rows, 'Kẽm', p.zincMg * factor, 'mg');

  // Combined EPA+DHA (mirrors the 'omega3' micro-battery convention in
  // microBatteryEngine.ts) — only shown when the food declares at least one.
  if (p.epaMg != null || p.dhaMg != null) {
    const omega3 = (p.epaMg ?? 0) * factor + (p.dhaMg ?? 0) * factor;
    pushIfNonZero(rows, 'EPA/DHA', omega3, 'mg');
  }

  return rows;
}

// Fallback for a food removed from every catalog (deleted custom food) since
// it was logged: only the nutrition snapshotted onto the entry at log time is
// available, so the breakdown is coarser — one rolled-up minerals figure,
// no fiber/sugar/EPA-DHA split.
function buildFromSnapshot(entry: FoodLogEntry): NutritionDetailRow[] {
  return [
    { label: 'Năng lượng', value: round1(entry.energyKcal), unit: 'kcal' },
    { label: 'Đạm', value: round1(entry.proteinG), unit: 'g' },
    { label: 'Béo', value: round1(entry.fatG), unit: 'g' },
    { label: 'Carbs', value: round1(entry.carbG), unit: 'g' },
    { label: 'Nước', value: round1(entry.waterG), unit: 'g' },
    { label: 'Khoáng chất (tổng)', value: round1(entry.mineralsMg), unit: 'mg' },
  ];
}

// Builds the nutrient rows for a logged portion. `item` must be resolved by
// the caller via getAnyFoodById(entry.foodId) (this module stays pure/DB-free)
// — pass null when the food is no longer in any catalog.
export function buildNutritionDetail(
  entry: FoodLogEntry,
  item: FoodItem | null
): NutritionDetailRow[] {
  return item ? buildFromItem(entry, item) : buildFromSnapshot(entry);
}
