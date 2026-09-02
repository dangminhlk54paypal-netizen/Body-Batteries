import {
  MY_FOODS_BACKUP_VERSION,
  parseMyFoodsBackup,
  serializeMyFoodsBackup,
} from '../myFoodsBackup';
import type { FoodItem } from '../../../types/food';

function food(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'custom_1',
    nameVi: 'Yakult',
    nameEn: '',
    category: 'drink',
    defaultServingG: 65,
    servingPresets: [],
    per100g: {
      energyKcal: 77,
      waterG: 80,
      proteinG: 1.2,
      fatG: 0,
      carbG: 18.5,
      fiberG: 0,
      sugarG: 17,
      calciumMg: 46,
      ironMg: 0,
      sodiumMg: 10,
      potassiumMg: 20,
      magnesiumMg: 3,
      zincMg: 0,
    },
    source: 'custom',
    note: '',
    portionUnit: 'serving',
    servingWeightG: 65,
    servingLabel: 'hộp',
    measureUnit: 'ml',
    ...overrides,
  };
}

describe('serialize -> parse round trip', () => {
  it('preserves the unit metadata that makes a food re-usable', () => {
    const text = serializeMyFoodsBackup([food()], [], 1_700_000_000_000);
    const parsed = parseMyFoodsBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.backup.version).toBe(MY_FOODS_BACKUP_VERSION);
    expect(parsed.backup.customFoods).toHaveLength(1);
    const restored = parsed.backup.customFoods[0];
    expect(restored.portionUnit).toBe('serving');
    expect(restored.servingLabel).toBe('hộp');
    expect(restored.measureUnit).toBe('ml');
    expect(restored.servingWeightG).toBe(65);
    expect(restored.per100g.sugarG).toBe(17);
  });

  it('carries overrides separately from custom foods', () => {
    const text = serializeMyFoodsBackup(
      [food()],
      [food({ id: 'whey_protein', source: 'override', nameVi: 'Whey' })],
      1
    );
    const parsed = parseMyFoodsBackup(text);
    if (!parsed.ok) throw new Error('expected a valid backup');
    expect(parsed.backup.customFoods.map((f) => f.id)).toEqual(['custom_1']);
    expect(parsed.backup.overrides.map((f) => f.id)).toEqual(['whey_protein']);
  });
});

describe('parseMyFoodsBackup rejections', () => {
  it('rejects text that is not JSON', () => {
    expect(parseMyFoodsBackup('not json at all')).toEqual({ ok: false, reasonKey: 'notJson' });
  });

  it('rejects a JSON value that is not an object', () => {
    expect(parseMyFoodsBackup('[1,2,3]')).toEqual({ ok: false, reasonKey: 'notJson' });
  });

  it('refuses an unknown version instead of guessing at its shape', () => {
    const text = JSON.stringify({ version: 99, customFoods: [food()], overrides: [] });
    expect(parseMyFoodsBackup(text)).toEqual({ ok: false, reasonKey: 'wrongVersion' });
  });

  it('reports an otherwise-valid file that carries no foods', () => {
    const text = serializeMyFoodsBackup([], [], 1);
    expect(parseMyFoodsBackup(text)).toEqual({ ok: false, reasonKey: 'empty' });
  });
});

describe('parseMyFoodsBackup hardening against a hand-edited file', () => {
  function parseRaw(customFoods: unknown[]) {
    return parseMyFoodsBackup(
      JSON.stringify({ version: MY_FOODS_BACKUP_VERSION, exportedAt: 1, customFoods, overrides: [] })
    );
  }

  it('drops rows with no id or no usable name rather than importing them broken', () => {
    const parsed = parseRaw([{ nameVi: 'No id' }, { id: 'x' }, food()]);
    if (!parsed.ok) throw new Error('expected the good row to survive');
    expect(parsed.backup.customFoods.map((f) => f.id)).toEqual(['custom_1']);
  });

  it('coerces missing/garbage nutrition to 0 instead of letting NaN reach the engine', () => {
    const parsed = parseRaw([{ id: 'a', nameVi: 'A', per100g: { energyKcal: 'lots', fatG: null } }]);
    if (!parsed.ok) throw new Error('expected a valid backup');
    const item = parsed.backup.customFoods[0];
    expect(item.per100g.energyKcal).toBe(0);
    expect(item.per100g.fatG).toBe(0);
    expect(Number.isNaN(item.per100g.proteinG)).toBe(false);
  });

  it('keeps the carbs >= sugar + fiber invariant the rest of the app relies on', () => {
    const parsed = parseRaw([
      { id: 'a', nameVi: 'A', per100g: { carbG: 3, sugarG: 8, fiberG: 2 } },
    ]);
    if (!parsed.ok) throw new Error('expected a valid backup');
    expect(parsed.backup.customFoods[0].per100g.carbG).toBe(10);
  });

  it('falls back to grams when a counted unit has no usable portion size', () => {
    const parsed = parseRaw([
      { id: 'a', nameVi: 'A', portionUnit: 'serving', servingLabel: 'hộp', servingWeightG: 0 },
    ]);
    if (!parsed.ok) throw new Error('expected a valid backup');
    const item = parsed.backup.customFoods[0];
    expect(item.portionUnit).toBe('gram');
    expect(item.servingWeightG).toBeUndefined();
    expect(item.servingLabel).toBeUndefined();
  });

  it('ignores unit values outside the known sets', () => {
    const parsed = parseRaw([
      { id: 'a', nameVi: 'A', portionUnit: 'barrel', measureUnit: 'gallons', servingWeightG: 10 },
    ]);
    if (!parsed.ok) throw new Error('expected a valid backup');
    expect(parsed.backup.customFoods[0].portionUnit).toBe('gram');
    expect(parsed.backup.customFoods[0].measureUnit).toBeUndefined();
  });
});
