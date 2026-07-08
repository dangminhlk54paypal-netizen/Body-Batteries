import { getAnyFoodById } from '../foodLookup';
import { getFoodById } from '../foodDatabase';
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

  it('getAnyFoodById returns the override alone when the base id no longer exists', () => {
    const orphan = makeOverride({ id: 'removed_catalog_id' });
    setOverrides([orphan]);
    expect(getAnyFoodById('removed_catalog_id')).toEqual(orphan);
  });
});
