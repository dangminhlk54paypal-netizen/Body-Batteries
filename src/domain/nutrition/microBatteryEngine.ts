import type { FoodItem, Nutrition, PortionUnit } from '../../types/food';
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

export function per100gValue(p: Nutrition, id: MicronutrientId): number {
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

// The subset of FoodLogEntry microBatterySourceRows needs. Portion fields are
// included so the breakdown can show WHAT was eaten ("×2 · 60g"), not just how
// much of the nutrient it carried — without them a food logged twice reads as
// two mystery rows with no way to tell a real second helping from a stray
// duplicate entry.
export interface MicroSourceEntry {
  foodId: string;
  foodNameVi: string;
  grams: number;
  portionUnit?: PortionUnit;
  count?: number;
}

export interface MicroSourceRow {
  // The foodId — rows are GROUPED per food, so this is a stable React key even
  // when the same food was logged several times.
  id: string;
  foodId: string;
  // Frozen snapshot name, the FALLBACK only: the view resolves the live name
  // via foodLogEntryDisplayName(row, language) so a catalog-backed food follows
  // a language switch (AGENTS.md §3).
  foodNameVi: string;
  amount: number; // in the nutrient's own unit (g/mg), 1 decimal
  grams: number; // total grams eaten across the grouped entries
  entryCount: number; // how many separate log rows were grouped into this one
  // Present only when every grouped entry shares one non-gram portion unit —
  // the total packs/capsules eaten, for a "2 viên" style label.
  portionUnit?: PortionUnit;
  count?: number;
  // The food's own per-100 figure for this nutrient — the LEFT side of the
  // multiplication the row's amount came from. Carried so the breakdown sheet
  // can show the arithmetic ("6g/100g × 60g ÷ 100 = 3.6g") instead of asking
  // the reader to trust a number that appeared from nowhere.
  per100g: number;
}

export interface MicroSourceBreakdown {
  rows: MicroSourceRow[];
  // Equals MicroBatteryState.current for the same day/nutrient, AND equals the
  // exact sum of the displayed row amounts — see apportionTenths.
  total: number;
}

// Splits `totalTenths` (the day's total, in tenths of the nutrient's unit)
// across the exact per-food amounts using the largest-remainder method, so the
// rounded numbers on screen add up to the rounded total on screen. Rounding
// each row on its own instead lets 1.75 + 1.75 render as "1.8 + 1.8 = 3.5",
// which is exactly the kind of off-by-a-notch the breakdown exists to rule out.
function apportionTenths(exactAmounts: number[], totalTenths: number): number[] {
  const scaled = exactAmounts.map((a) => a * 10);
  const floors = scaled.map(Math.floor);
  let remaining = totalTenths - floors.reduce((sum, f) => sum + f, 0);
  // Hand the leftover tenths to the largest fractional parts first.
  const order = scaled
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (const { i } of order) {
    if (remaining <= 0) break;
    result[i] += 1;
    remaining -= 1;
  }
  return result.map((tenths) => tenths / 10);
}

// The per-food "where did this micronutrient come from" breakdown for
// MicroBatterySourceSheet. Recomputed live via per100gValue rather than read
// off FoodLogEntry, since a logged entry only snapshots macros/minerals (see
// types/food.ts), never the individual micronutrient breakdown.
//
// Rows are grouped BY FOOD, not per log entry: three separate scoops of whey
// are one "Whey protein ×3" row rather than three identical-looking rows that
// invite the reader to miscount how many were actually logged.
export function microBatterySourceBreakdown(
  foodLog: MicroSourceEntry[],
  nutrientId: MicronutrientId,
  lookup: (foodId: string) => FoodItem | undefined
): MicroSourceBreakdown {
  // Insertion-ordered so rows keep the order the foods were first logged in.
  const grouped = new Map<string, MicroSourceRow & { exact: number }>();
  let exactTotal = 0;

  for (const entry of foodLog) {
    const item = lookup(entry.foodId);
    if (!item) continue; // unknown/deleted foodId — skip safely, same as computeMicroBatteries
    const grams = Math.max(0, entry.grams);
    const per100g = per100gValue(item.per100g, nutrientId);
    const exact = (per100g * grams) / 100;
    exactTotal += exact;
    if (exact <= 0) continue;

    const existing = grouped.get(entry.foodId);
    if (!existing) {
      grouped.set(entry.foodId, {
        id: entry.foodId,
        foodId: entry.foodId,
        foodNameVi: entry.foodNameVi,
        amount: 0, // filled in by apportionTenths below
        grams,
        entryCount: 1,
        exact,
        portionUnit: entry.portionUnit,
        count: entry.count,
        per100g,
      });
      continue;
    }
    existing.grams += grams;
    existing.entryCount += 1;
    existing.exact += exact;
    // Only keep a count label while every grouped entry agrees on the unit —
    // a food logged once by pack and once by grams has no single honest count.
    if (existing.portionUnit != null && existing.portionUnit === entry.portionUnit) {
      existing.count = (existing.count ?? 0) + (entry.count ?? 0);
    } else {
      existing.portionUnit = undefined;
      existing.count = undefined;
    }
  }

  const collected = [...grouped.values()];
  // round1 of the exact total — the SAME figure computeMicroBatteries reports
  // as MicroBatteryState.current, so the sheet's footer can never contradict
  // the battery cell that opened it.
  const total = round1(exactTotal);
  const amounts = apportionTenths(
    collected.map((r) => r.exact),
    Math.round(total * 10)
  );

  const rows = collected
    .map(({ exact: _exact, ...row }, i) => ({ ...row, amount: amounts[i] }))
    .filter((row) => row.amount > 0);

  return { rows, total };
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
