import type { FoodItem, Nutrition } from '../../types/food';
import type { MicronutrientId, MicroBatteryState, NutrientTarget } from '../../types/nutrition';

// Pure micronutrient-battery engine. Takes today's (or any day's) logged
// entries plus a food lookup — no DB/store import here, so this stays fully
// unit-testable (see .ai/parallel-reports/S-R-micronutrient-batteries-spec.md
// section 1B).

// Only foodId + grams are used — the rest of a FoodLogEntry (its own snapshot
// fields) is ignored, since those don't carry the micronutrient breakdown.
export interface LoggedPortion {
  foodId: string;
  grams: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Real ratio of target, allowed past 100% so over-consumption stays visible
// (e.g. 134% fiber). Capped at 999 so one extreme entry can't blow up the UI.
function pctOf(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(999, Math.round((100 * current) / target)));
}

function per100gValue(p: Nutrition, id: MicronutrientId): number {
  switch (id) {
    case 'fiber':
      return p.fiberG;
    case 'iron':
      return p.ironMg;
    case 'calcium':
      return p.calciumMg;
    case 'fat':
      return p.fatG;
    case 'potassium':
      return p.potassiumMg;
    case 'magnesium':
      return p.magnesiumMg;
    case 'zinc':
      return p.zincMg;
    case 'sodium':
      return p.sodiumMg;
    case 'sugar':
      return p.sugarG;
    case 'omega3':
      // Combined EPA+DHA — only rows that declare epa_mg/dha_mg contribute.
      return (p.epaMg ?? 0) + (p.dhaMg ?? 0);
    case 'salt':
      // Derived from sodium, NOT a stored field — 2.5 g NaCl per 1 g sodium
      // (standard salt<->sodium conversion). This means salt auto-updates
      // whenever any food (built-in, USDA, or custom) logs sodium — no
      // separate data-entry path needed.
      return (p.sodiumMg * 2.5) / 1000;
  }
}

export interface MicroSourceRow {
  id: string;
  label: string;
  amount: number; // already in the nutrient's own unit (g/mg), 1-decimal rounded
}

// One row per logged food that contributed a nonzero amount of `nutrientId` —
// the per-food "where did this micronutrient come from" breakdown for
// MicroBatterySourceSheet. Recomputed live via per100gValue rather than read
// off FoodLogEntry, since a logged entry only snapshots macros/minerals (see
// types/food.ts), never the individual micronutrient breakdown.
export function microBatterySourceRows(
  foodLog: { id: string; foodId: string; foodNameVi: string; grams: number }[],
  nutrientId: MicronutrientId,
  lookup: (foodId: string) => FoodItem | undefined
): MicroSourceRow[] {
  const rows: MicroSourceRow[] = [];
  for (const entry of foodLog) {
    const item = lookup(entry.foodId);
    if (!item) continue; // unknown/deleted foodId — skip safely
    const amount = round1((per100gValue(item.per100g, nutrientId) * Math.max(0, entry.grams)) / 100);
    if (amount > 0) rows.push({ id: entry.id, label: entry.foodNameVi, amount });
  }
  return rows;
}

export function computeMicroBatteries(
  entries: LoggedPortion[],
  lookup: (foodId: string) => FoodItem | undefined,
  targets: NutrientTarget[]
): MicroBatteryState[] {
  const totals: Partial<Record<MicronutrientId, number>> = {};

  for (const entry of entries) {
    const item = lookup(entry.foodId);
    if (!item) continue; // unknown/deleted foodId — skip safely, don't break the total

    const factor = Math.max(0, entry.grams) / 100;
    for (const target of targets) {
      const add = per100gValue(item.per100g, target.id) * factor;
      totals[target.id] = (totals[target.id] ?? 0) + add;
    }
  }

  return targets.map((target) => {
    const current = round1(totals[target.id] ?? 0);
    const over = current > target.value;
    const percentage = pctOf(current, target.value);

    return {
      id: target.id,
      kind: target.kind,
      nameVi: target.nameVi,
      unit: target.unit,
      color: target.color,
      current,
      target: target.value,
      percentage,
      over,
    };
  });
}
