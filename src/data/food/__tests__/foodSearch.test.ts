import { ALL_FOODS, searchAllFoods } from '../foodSearch';
import { FOOD_ITEMS } from '../foodDatabase';
import { USDA_FOODS } from '../usdaFoods';
import { setCustomFoods } from '../customFoodRegistry';
import type { FoodItem } from '../../../types/food';

const EMPTY_NUTRITION = {
  energyKcal: 0,
  waterG: 0,
  proteinG: 0,
  fatG: 0,
  carbG: 0,
  fiberG: 0,
  sugarG: 0,
  calciumMg: 0,
  ironMg: 0,
  sodiumMg: 0,
  potassiumMg: 0,
  magnesiumMg: 0,
  zincMg: 0,
};

// Merged bilingual search over FOOD_ITEMS (Vietnamese dish catalog) +
// USDA_FOODS (USDA ingredient catalog) — the single search box that replaced
// the "Món Việt" / "Tra cứu USDA (EN)" tabs in FoodLogModal.
describe('foodSearch', () => {
  it('merges both catalogs with no id overlap', () => {
    expect(ALL_FOODS.length).toBe(FOOD_ITEMS.length + USDA_FOODS.length);
    const ids = new Set(ALL_FOODS.map((f) => f.id));
    expect(ids.size).toBe(ALL_FOODS.length); // no duplicate/overlapping ids
  });

  describe('accent-insensitive normalization', () => {
    it('matches a Vietnamese dish by its unaccented ASCII spelling', () => {
      const results = searchAllFoods('com trang');
      expect(results.some((f) => f.id === 'rice_white_cooked')).toBe(true);
    });

    it('matches đ/Đ the same as plain d', () => {
      // "Đậu gà nghiền" (hummus) normalizes "đậu" -> "dau".
      const results = searchAllFoods('dau ga nghien');
      expect(results.some((f) => f.id === 'usda_321358')).toBe(true);
    });

    it('matches a salmon row by Vietnamese name, English name, or unaccented Vietnamese', () => {
      const byVi = searchAllFoods('cá hồi');
      const byUnaccented = searchAllFoods('ca hoi');
      const byEn = searchAllFoods('salmon');
      expect(byVi.length).toBeGreaterThan(0);
      expect(byUnaccented.length).toBeGreaterThan(0);
      expect(byEn.length).toBeGreaterThan(0);
      // All three queries should find the same underlying salmon item(s).
      const viIds = new Set(byVi.map((f) => f.id));
      const unaccentedIds = new Set(byUnaccented.map((f) => f.id));
      const enIds = new Set(byEn.map((f) => f.id));
      for (const id of enIds) {
        expect(viIds.has(id) || unaccentedIds.has(id)).toBe(true);
      }
    });

    it('requires every whitespace-separated token to match (multi-token AND)', () => {
      const results = searchAllFoods('cá hồi Atlantic');
      expect(results.every((f) => {
        const hay = `${f.nameVi} ${f.nameEn} ${f.category}`.toLowerCase();
        return hay.includes('atlantic');
      })).toBe(true);
    });
  });

  describe('German name search (nameDe, search-only)', () => {
    it('matches Brötchen by the accented, umlaut-dropped, and umlaut-expanded spellings', () => {
      const accented = searchAllFoods('brötchen');
      const dropped = searchAllFoods('brotchen');
      const expanded = searchAllFoods('broetchen');
      expect(accented.some((f) => f.id === 'broetchen')).toBe(true);
      expect(dropped.some((f) => f.id === 'broetchen')).toBe(true);
      expect(expanded.some((f) => f.id === 'broetchen')).toBe(true);
    });

    it('matches chicken breast by the accented and umlaut-expanded German name', () => {
      const accented = searchAllFoods('hähnchen');
      const expanded = searchAllFoods('haehnchen');
      expect(accented.some((f) => f.id === 'chicken_breast')).toBe(true);
      expect(expanded.some((f) => f.id === 'chicken_breast')).toBe(true);
    });

    it('every USDA row has a non-empty nameDe after gen:usda (full cover file)', () => {
      for (const f of USDA_FOODS) {
        expect((f.nameDe ?? '').trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('ranking', () => {
    it('empty query returns the Vietnamese catalog first, then USDA', () => {
      const results = searchAllFoods('');
      expect(results.length).toBe(ALL_FOODS.length);
      const lastViIndex = FOOD_ITEMS.length - 1;
      // Every Vietnamese item should appear before every USDA item.
      const idToIndex = new Map(results.map((f, i) => [f.id, i]));
      for (const vi of FOOD_ITEMS) {
        for (const usda of USDA_FOODS) {
          expect(idToIndex.get(vi.id)!).toBeLessThan(idToIndex.get(usda.id)!);
        }
      }
      expect(lastViIndex).toBeGreaterThanOrEqual(0); // sanity: VN catalog non-empty
    });

    it('searching "cơm" puts Vietnamese rice ahead of any USDA result', () => {
      const results = searchAllFoods('cơm');
      const riceIndex = results.findIndex((f) => f.id === 'rice_white_cooked');
      expect(riceIndex).toBeGreaterThanOrEqual(0);
      const firstUsdaIndex = results.findIndex((f) => f.id.startsWith('usda_'));
      if (firstUsdaIndex !== -1) {
        expect(riceIndex).toBeLessThan(firstUsdaIndex);
      }
    });

    it('a query typed WITH diacritics ranks diacritic-exact names first', () => {
      // "gà" must put chicken dishes above "Gạo …" rice rows — accent-stripped
      // both contain "ga", but the user's accented query disambiguates.
      const results = searchAllFoods('gà');
      const chickenIndex = results.findIndex((f) => f.id === 'chicken_breast');
      const riceIndex = results.findIndex((f) => f.id === 'rice_brown_cooked');
      expect(chickenIndex).toBeGreaterThanOrEqual(0);
      expect(riceIndex).toBeGreaterThanOrEqual(0);
      expect(chickenIndex).toBeLessThan(riceIndex);

      // Accent-less "ga" stays broad: both chicken and rice still match.
      const broad = searchAllFoods('ga');
      expect(broad.some((f) => f.id === 'chicken_breast')).toBe(true);
      expect(broad.some((f) => f.id === 'rice_brown_cooked')).toBe(true);
    });

    it('an exact/prefix name match ranks above a mid-string-only match', () => {
      // "gà" is a mid-string hit for "Ức gà" (Chicken breast) but a prefix
      // hit for anything whose name starts with "Gà" (e.g. the "Gà tây"
      // — turkey — USDA rows, since "gà tây" literally starts with "gà").
      // Whichever ranks first, prefix/exact hits must never rank below a
      // pure mid-string hit.
      const results = searchAllFoods('ga');
      // Mirrors the normalize() in ../foodSearch.ts (lowercase + NFD strip +
      // đ -> d), duplicated here so this is an independent check.
      const norm = (s: string) =>
        s
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .trim();
      const tierOf = (id: string) => {
        const f = ALL_FOODS.find((x) => x.id === id)!;
        const nv = norm(f.nameVi);
        const ne = norm(f.nameEn);
        if (nv.startsWith('ga') || ne.startsWith('ga')) return 1;
        return 2;
      };
      for (let i = 1; i < results.length; i++) {
        expect(tierOf(results[i - 1].id)).toBeLessThanOrEqual(tierOf(results[i].id));
      }
      // Sanity: the known Vietnamese "gà" dishes are found at all.
      const ids = results.map((f) => f.id);
      expect(ids).toEqual(expect.arrayContaining(['chicken_breast', 'chicken_thigh']));
    });
  });

  describe('custom foods (runtime registry, S-* foundation)', () => {
    afterEach(() => {
      setCustomFoods([]); // don't leak custom-food state into other test blocks
    });

    it('surfaces a registered custom food that matches the query', () => {
      const custom: FoodItem = {
        id: 'custom_grandma_pho',
        nameVi: 'Phở bà nấu',
        nameEn: "Grandma's pho",
        category: 'custom',
        defaultServingG: 500,
        servingPresets: [],
        per100g: { ...EMPTY_NUTRITION, energyKcal: 60 },
        source: 'custom',
        note: '',
      };
      setCustomFoods([custom]);

      const results = searchAllFoods('pho ba nau');
      expect(results.some((f) => f.id === 'custom_grandma_pho')).toBe(true);
    });

    it('ranks a custom food above a same-tier catalog food', () => {
      // "Cơm trắng" (rice_white_cooked) is an exact-name catalog match for
      // "cơm trắng". A custom food with the SAME exact name should still
      // rank above it — the user's own entry beats the generic catalog one.
      const custom: FoodItem = {
        id: 'custom_com_trang_nha',
        nameVi: 'Cơm trắng',
        nameEn: 'My white rice',
        category: 'custom',
        defaultServingG: 150,
        servingPresets: [],
        per100g: { ...EMPTY_NUTRITION, energyKcal: 130 },
        source: 'custom',
        note: '',
      };
      setCustomFoods([custom]);

      const results = searchAllFoods('cơm trắng');
      const customIndex = results.findIndex((f) => f.id === 'custom_com_trang_nha');
      const catalogIndex = results.findIndex((f) => f.id === 'rice_white_cooked');
      expect(customIndex).toBeGreaterThanOrEqual(0);
      expect(catalogIndex).toBeGreaterThanOrEqual(0);
      expect(customIndex).toBeLessThan(catalogIndex);
    });

    it('lists custom foods first on an empty query', () => {
      const custom: FoodItem = {
        id: 'custom_snack_bar',
        nameVi: 'Thanh snack tự làm',
        nameEn: 'Homemade snack bar',
        category: 'custom',
        defaultServingG: 40,
        servingPresets: [],
        per100g: { ...EMPTY_NUTRITION, energyKcal: 180 },
        source: 'custom',
        note: '',
      };
      setCustomFoods([custom]);

      const results = searchAllFoods('');
      expect(results[0].id).toBe('custom_snack_bar');
      expect(results.length).toBe(ALL_FOODS.length + 1);
    });
  });
});
