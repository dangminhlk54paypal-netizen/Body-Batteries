import { searchFoods } from '../foodSearch';
import { getAnyFoodById, foodLogEntryDisplayName } from '../foodLookup';
import { setCustomFoods } from '../customFoodRegistry';
import {
  cacheLibraryFoods,
  getLibrarySourceOfFood,
  registerLibrarySource,
  resetLibraryRegistry,
  searchLibraryCandidates,
} from '../libraryFoodRegistry';
import { foodSourceKind } from '../../../domain/food/foodSource';
import { libraryFoodId } from '../../../domain/food/library/libraryMapping';
import {
  libraryFoodBindValues,
  librarySearchText,
  rowToLibraryFood,
  type LibraryFoodRow,
} from '../../repositories/libraryFoodMapper';
import type { FoodItem } from '../../../types/food';
import type { LibrarySource } from '../../../types/foodLibrary';

const mockSearchLibraryFoods = jest.fn();
jest.mock('../../repositories/libraryFoodsRepository', () => ({
  searchLibraryFoods: (...args: unknown[]) => mockSearchLibraryFoods(...args),
}));

const NUTRITION = {
  energyKcal: 120,
  waterG: 0,
  proteinG: 20,
  fatG: 3,
  carbG: 2,
  fiberG: 0,
  sugarG: 1,
  calciumMg: 10,
  ironMg: 1,
  sodiumMg: 50,
  potassiumMg: 300,
  magnesiumMg: 20,
  zincMg: 1,
};

function libraryFood(sourceId: string, name: string, extra: Partial<FoodItem> = {}): FoodItem {
  return {
    id: libraryFoodId(sourceId, name),
    nameVi: name,
    nameEn: '',
    nameDe: '',
    category: '',
    defaultServingG: 100,
    servingPresets: [],
    per100g: NUTRITION,
    source: 'library',
    note: '',
    ...extra,
  };
}

function source(id: string, patch: Partial<LibrarySource> = {}): LibrarySource {
  return {
    id,
    name: 'Bảng của tôi',
    fileName: 'foods.csv',
    enabled: true,
    foodCount: 1,
    mapping: null,
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

afterEach(() => {
  resetLibraryRegistry();
  setCustomFoods([]);
  mockSearchLibraryFoods.mockReset();
});

describe('library foods in search', () => {
  it('ranks library rows after the user’s own foods and before the catalog', () => {
    const lib = libraryFood('s1', 'Cơm gạo lứt nhà làm');
    const custom = { ...libraryFood('x', 'Cơm gạo lứt mẹ nấu'), id: 'custom_1', source: 'custom' };
    setCustomFoods([custom]);
    const { matches } = searchFoods('com gao lut', { library: [lib] });
    const ids = matches.map((m) => m.id);
    expect(ids.slice(0, 2)).toEqual(['custom_1', lib.id]);
  });

  it('drops library rows that do not match the current query', () => {
    const stale = libraryFood('s1', 'Quark mager');
    expect(searchFoods('com', { library: [stale] }).matches.map((m) => m.id)).not.toContain(stale.id);
  });

  it('classifies library rows as their own source kind', () => {
    expect(foodSourceKind(libraryFood('s1', 'Quark'))).toBe('library');
  });
});

describe('libraryFoodRegistry', () => {
  it('returns nothing for an empty query or when every source is off, without querying', async () => {
    registerLibrarySource(source('s1', { enabled: false }));
    expect(await searchLibraryCandidates('quark')).toEqual([]);
    registerLibrarySource(source('s1'));
    expect(await searchLibraryCandidates('  ')).toEqual([]);
    expect(mockSearchLibraryFoods).not.toHaveBeenCalled();
  });

  it('searches with folded words and caches the results for getAnyFoodById', async () => {
    const quark = libraryFood('s1', 'Magerquark');
    registerLibrarySource(source('s1'));
    mockSearchLibraryFoods.mockResolvedValue([quark]);
    expect(await searchLibraryCandidates('Mägerquark 500g')).toEqual([quark]);
    expect(mockSearchLibraryFoods).toHaveBeenCalledWith(['magerquark', '500g'], expect.any(Number));
    expect(getAnyFoodById(quark.id)).toEqual(quark);
  });

  it('names the source of a library food for its badge', () => {
    registerLibrarySource(source('s1', { name: 'BLS' }));
    expect(getLibrarySourceOfFood(libraryFood('s1', 'x').id)?.name).toBe('BLS');
    expect(getLibrarySourceOfFood('rice_white_cooked')).toBeUndefined();
  });

  it('lets a logged library food follow the live row, and fall back to the snapshot once gone', () => {
    const quark = libraryFood('s1', 'Magerquark', { nameEn: 'Low-fat quark' });
    const entry = { foodId: quark.id, foodNameVi: 'Magerquark' };
    cacheLibraryFoods([quark]);
    expect(foodLogEntryDisplayName(entry, 'en')).toBe('Low-fat quark');
    resetLibraryRegistry();
    expect(foodLogEntryDisplayName(entry, 'en')).toBe('Magerquark');
  });
});

describe('libraryFoodMapper', () => {
  it('round-trips a FoodItem through the row shape', () => {
    const item = libraryFood('s1', 'Lachs', { nameDe: 'Lachs', category: 'fish', per100g: { ...NUTRITION, epaMg: 900 } });
    const values = libraryFoodBindValues(item, 's1');
    const columns = [
      'id', 'source_id', 'name_vi', 'name_en', 'name_de', 'name_norm', 'category', 'default_serving_g',
      'energy_kcal', 'water_g', 'protein_g', 'fat_g', 'carb_g', 'fiber_g', 'sugar_g',
      'calcium_mg', 'iron_mg', 'sodium_mg', 'potassium_mg', 'magnesium_mg', 'zinc_mg', 'epa_mg', 'dha_mg',
    ];
    expect(values).toHaveLength(columns.length);
    const row = Object.fromEntries(columns.map((c, i) => [c, values[i]])) as unknown as LibraryFoodRow;
    expect(rowToLibraryFood(row)).toEqual({ ...item, per100g: { ...item.per100g, dhaMg: undefined } });
  });

  it('folds every name for the SQL search, German also with expanded umlauts', () => {
    expect(librarySearchText({ nameVi: 'Bánh mì', nameEn: 'Bread roll', nameDe: 'Brötchen', category: 'grain' })).toBe(
      'banh mi bread roll brotchen broetchen grain'
    );
  });
});
