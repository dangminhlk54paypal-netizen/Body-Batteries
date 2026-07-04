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

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
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
  }
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
    const over = target.kind === 'limit' && current > target.value;
    const percentage = over ? 100 : clampPct((100 * current) / target.value);

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
