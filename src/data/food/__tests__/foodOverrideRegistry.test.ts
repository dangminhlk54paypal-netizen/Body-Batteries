import { getAnyFoodById } from '../foodLookup';
import { getFoodById } from '../foodDatabase';
import { setCustomFoods } from '../customFoodRegistry';
import {
  setOverrides,
  getOverrideByIdSync,
  getAllOverridesSync,
} from '../foodOverrideRegistry';
import type { FoodItem } from '../../../types/food';

// A real catalog id we can safely shadow. Every VN CSV row is per-100g.
const BASE_ID = 'rice_white_cooked';

// Builds a full FoodItem override that changes only ironMg, keeping the rest
// of the numbers arbitrary — the merge test asserts other fields stay from the
// base, so these values must NOT accidentally match the base.
function makeOverride(patch: Partial<FoodItem>): FoodItem {
  return {
    id: BASE_ID,
    nameVi: 'Cơm trắng (đã sửa)',
    nameEn: 'White rice (corrected)',
    nameDe: '',
    category: 'grains',
    defaultServingG: 150,
    servingPresets: [],
    per100g: {
      energyKcal: 130,
      waterG: 68,
      proteinG: 2.7,
      fatG: 0.3,
      carbG: 28,
      fiberG: 0.4,
      sugarG: 0.1,
      calciumMg: 10,
      ironMg: 99, // the intentional correction
      sodiumMg: 1,
      potassiumMg: 35,
      magnesiumMg: 12,
      zincMg: 0.5,
    },
    source: 'override',
    note: '',
    ...patch,
  };
}

describe('foodOverrideRegistry + getAnyFoodById merge', () => {
  afterEach(() => {
    setOverrides([]); // don't leak override state into other tests
  });

  it('getOverrideByIdSync returns an item seeded via setOverrides', () => {
    const ov = makeOverride({});
    setOverrides([ov]);
    expect(getOverrideByIdSync(BASE_ID)).toEqual(ov);
    expect(getAllOverridesSync()).toHaveLength(1);
  });

  it('getOverrideByIdSync returns undefined for an id with no override', () => {
    setOverrides([]);
    expect(getOverrideByIdSync(BASE_ID)).toBeUndefined();
  });

  it('getAnyFoodById returns the base unchanged when no override exists', () => {
    setOverrides([]);
    const base = getFoodById(BASE_ID);
    expect(base).toBeDefined();
    expect(getAnyFoodById(BASE_ID)).toEqual(base);
  });

  it('getAnyFoodById MERGES an override on top of the base (corrected field wins, others from base)', () => {
    const base = getFoodById(BASE_ID);
    expect(base).toBeDefined();

    setOverrides([makeOverride({})]);
    const merged = getAnyFoodById(BASE_ID);

    // The corrected per-100g value wins.
    expect(merged?.per100g.ironMg).toBe(99);
    // The override's name/category win.
    expect(merged?.nameVi).toBe('Cơm trắng (đã sửa)');
    // A per-100g field the override also set stays as the override's value.
    expect(merged?.per100g.energyKcal).toBe(130);
    // Fields an override has NO column for (servingPresets/nameDe/note/source)
    // must fall back to the base — the override object's synthetic ''/[] values
    // must NOT wipe them (this is the merge fix; presets survive an app restart
    // where the override is rehydrated from DB with empty presets).
    expect(merged?.servingPresets).toEqual(base?.servingPresets);
    expect(merged?.nameDe).toBe(base?.nameDe);
    expect(merged?.source).toBe(base?.source);
  });

  // Fix #2 regression: portionUnit/servingWeightG (the "pack"/"capsule" unit
  // fields, e.g. correcting a supplement's grams-per-capsule) were dropped by
  // the merge — every app-wide lookup silently fell back to the base
  // catalog's unit, ignoring the user's correction.
  it('getAnyFoodById merges the override portionUnit/servingWeightG (Fix #2)', () => {
    setOverrides([
      makeOverride({ portionUnit: 'capsule', servingWeightG: 1.2 }),
    ]);
    const merged = getAnyFoodById(BASE_ID);
    expect(merged?.portionUnit).toBe('capsule');
    expect(merged?.servingWeightG).toBe(1.2);
  });

  it('getAnyFoodById falls back to the base portionUnit/servingWeightG when the override leaves them unset', () => {
    const base = getFoodById(BASE_ID);
    setOverrides([makeOverride({})]); // no portionUnit/servingWeightG patch
    const merged = getAnyFoodById(BASE_ID);
    expect(merged?.portionUnit).toBe(base?.portionUnit);
    expect(merged?.servingWeightG).toBe(base?.servingWeightG);
  });

  // Fix #7 regression: correcting a TPCN's unit back to 'gram' must not let a
  // stale pack/capsule servingWeightG (from the BASE record, e.g. an
  // outdated 1.22 g/capsule figure) leak through — buildCustomFoodItem never
  // sets servingWeightG for a 'gram' input, so the merge must force it
  // undefined rather than falling back via `??` to base.servingWeightG.
  it('getAnyFoodById forces servingWeightG to undefined when an override switches a capsule TPCN back to gram (Fix #7)', () => {
    const CUSTOM_ID = 'custom_omega3_test';
    // The base (a user-added custom food) is a capsule supplement: 1.22 g each.
    setCustomFoods([
      {
        id: CUSTOM_ID,
        nameVi: 'Omega-3 viên',
        nameEn: '',
        category: 'supplement',
        defaultServingG: 1.22,
        servingPresets: [],
        per100g: {
          energyKcal: 737.7,
          waterG: 0,
          proteinG: 0,
          fatG: 82,
          carbG: 0,
          fiberG: 0,
          sugarG: 0,
          calciumMg: 0,
          ironMg: 0,
          sodiumMg: 0,
          potassiumMg: 0,
          magnesiumMg: 0,
          zincMg: 0,
          epaMg: 24590,
          dhaMg: 25410,
        },
        source: 'custom',
        note: '',
        portionUnit: 'capsule',
        servingWeightG: 1.22,
      },
    ]);
    try {
      // The user now corrects the unit back to 'gram' — buildCustomFoodItem
      // leaves servingWeightG blank (undefined) for a gram-based input.
      setOverrides([
        makeOverride({
          id: CUSTOM_ID,
          portionUnit: 'gram',
          servingWeightG: undefined,
        }),
      ]);
      const merged = getAnyFoodById(CUSTOM_ID);
      expect(merged?.portionUnit).toBe('gram');
      expect(merged?.servingWeightG).toBeUndefined();
    } finally {
      setCustomFoods([]); // don't leak into other tests
    }
  });

  it('getAnyFoodById returns the override alone when the base id no longer exists', () => {
    const orphan = makeOverride({ id: 'removed_catalog_id' });
    setOverrides([orphan]);
    expect(getAnyFoodById('removed_catalog_id')).toEqual(orphan);
  });
});
