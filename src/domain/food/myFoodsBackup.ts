import type { FoodItem, MeasureUnit, Nutrition, PortionUnit } from '../../types/food';

// Pure serialize/parse for the user's personal food list ("Món của tôi"):
// the foods they added themselves plus the nutrition corrections they made to
// catalog rows. No I/O — the service layer owns reading/writing the file, so
// this whole module stays unit-testable and can be reasoned about on its own.
//
// WHY a backup at all: the catalog that ships with the app is a starting
// point, not the product. What makes the app usable for one person is the
// foods THEY entered — their brands, their portions, their corrections — and
// that work lives only in this device's SQLite. A phone that dies takes it
// with it. This file is the user's own copy of that work.

// Bumped only on a BREAKING shape change. parseMyFoodsBackup rejects a
// version it does not know rather than guessing, so a file written by a newer
// app never gets silently misread by an older one.
export const MY_FOODS_BACKUP_VERSION = 1;

export interface MyFoodsBackup {
  version: number;
  exportedAt: number; // unix ms, informational only
  // Foods the user created. Restored into `custom_foods`.
  customFoods: FoodItem[];
  // Corrections the user made to catalog foods, keyed by the catalog id they
  // correct. Restored into `food_overrides` — an override whose base food no
  // longer exists still resolves on its own (see getAnyFoodById).
  overrides: FoodItem[];
}

export interface ParsedBackup {
  ok: true;
  backup: MyFoodsBackup;
}
export interface RejectedBackup {
  ok: false;
  // A translation key under `myFoods.import.*`, NOT a message — the caller
  // renders it in the user's language (AGENTS.md: no user-facing text here).
  reasonKey: string;
}

export function serializeMyFoodsBackup(
  customFoods: FoodItem[],
  overrides: FoodItem[],
  exportedAt: number
): string {
  const backup: MyFoodsBackup = {
    version: MY_FOODS_BACKUP_VERSION,
    exportedAt,
    customFoods,
    overrides,
  };
  return JSON.stringify(backup, null, 2);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown): number {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

const PORTION_UNITS: PortionUnit[] = ['gram', 'pack', 'capsule', 'serving'];
const MEASURE_UNITS: MeasureUnit[] = ['g', 'ml'];

function optionalPortionUnit(v: unknown): PortionUnit | undefined {
  return PORTION_UNITS.includes(v as PortionUnit) ? (v as PortionUnit) : undefined;
}

function optionalMeasureUnit(v: unknown): MeasureUnit | undefined {
  return MEASURE_UNITS.includes(v as MeasureUnit) ? (v as MeasureUnit) : undefined;
}

function optionalNumber(v: unknown): number | undefined {
  return typeof v === 'number' && isFinite(v) ? v : undefined;
}

// Rebuilds a FoodItem defensively from untrusted JSON: every field is coerced
// to its expected type with a safe default, so a hand-edited or truncated
// backup can never inject NaN/undefined into the nutrition engine. A row
// without a usable id or name is dropped rather than imported broken.
function toFoodItem(raw: unknown): FoodItem | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id).trim();
  const nameVi = str(raw.nameVi).trim();
  const nameEn = str(raw.nameEn).trim();
  if (!id) return null;
  if (!nameVi && !nameEn) return null;

  const p = isRecord(raw.per100g) ? raw.per100g : {};
  const per100g: Nutrition = {
    energyKcal: Math.max(0, num(p.energyKcal)),
    waterG: Math.max(0, num(p.waterG)),
    proteinG: Math.max(0, num(p.proteinG)),
    fatG: Math.max(0, num(p.fatG)),
    carbG: Math.max(0, num(p.carbG)),
    fiberG: Math.max(0, num(p.fiberG)),
    sugarG: Math.max(0, num(p.sugarG)),
    calciumMg: Math.max(0, num(p.calciumMg)),
    ironMg: Math.max(0, num(p.ironMg)),
    sodiumMg: Math.max(0, num(p.sodiumMg)),
    potassiumMg: Math.max(0, num(p.potassiumMg)),
    magnesiumMg: Math.max(0, num(p.magnesiumMg)),
    zincMg: Math.max(0, num(p.zincMg)),
    epaMg: optionalNumber(p.epaMg),
    dhaMg: optionalNumber(p.dhaMg),
  };
  // Same invariant every other entry point enforces (types/food.ts): total
  // carbs contain sugar + fiber, so they can never sit below their own parts.
  per100g.carbG = Math.max(per100g.carbG, per100g.sugarG + per100g.fiberG);

  const portionUnit = optionalPortionUnit(raw.portionUnit);
  const servingWeightG = optionalNumber(raw.servingWeightG);
  const counted = portionUnit != null && portionUnit !== 'gram' && (servingWeightG ?? 0) > 0;

  return {
    id,
    nameVi: nameVi || nameEn,
    nameEn,
    nameDe: str(raw.nameDe) || undefined,
    category: str(raw.category) || 'custom',
    defaultServingG: Math.max(1, num(raw.defaultServingG) || 100),
    servingPresets: [],
    per100g,
    source: str(raw.source) || 'custom',
    note: str(raw.note),
    // A counted unit is only honoured together with a usable portion size —
    // otherwise the food falls back to plain grams, exactly as
    // buildCustomFoodItem does for the same half-filled case.
    portionUnit: counted ? portionUnit : 'gram',
    servingWeightG: counted ? servingWeightG : undefined,
    servingLabel: counted && portionUnit === 'serving' ? str(raw.servingLabel) || undefined : undefined,
    measureUnit: optionalMeasureUnit(raw.measureUnit),
  };
}

function toFoodItems(raw: unknown): FoodItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toFoodItem).filter((item): item is FoodItem => item !== null);
}

// Parses a backup file's text. Returns a typed rejection (never throws) so
// the UI can explain WHY a file was refused instead of failing silently.
export function parseMyFoodsBackup(text: string): ParsedBackup | RejectedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reasonKey: 'notJson' };
  }
  if (!isRecord(raw)) return { ok: false, reasonKey: 'notJson' };
  if (raw.version !== MY_FOODS_BACKUP_VERSION) {
    return { ok: false, reasonKey: 'wrongVersion' };
  }

  const customFoods = toFoodItems(raw.customFoods);
  const overrides = toFoodItems(raw.overrides);
  if (customFoods.length === 0 && overrides.length === 0) {
    return { ok: false, reasonKey: 'empty' };
  }

  return {
    ok: true,
    backup: {
      version: MY_FOODS_BACKUP_VERSION,
      exportedAt: num(raw.exportedAt),
      customFoods,
      overrides,
    },
  };
}
