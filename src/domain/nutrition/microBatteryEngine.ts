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
