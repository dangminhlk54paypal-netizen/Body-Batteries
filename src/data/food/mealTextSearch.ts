import type { FoodItem } from '../../types/food';
import type { DecodedMealItem } from '../../domain/food/mealText/parseMealText';
import { foodSourceKind } from '../../domain/food/foodSource';
import { normalize, searchFoods, type FoodSearchResult } from './foodSearch';
import { getAnyFoodById } from './foodLookup';
import { searchLibraryCandidates } from './libraryFoodRegistry';

// The food search behind "Nạp bằng chữ" (domain/food/mealText). Same merged
// search as the ⚡ Nạp list, with one addition: a BARE everyday word means the
// plain staple. Typed in the search box, "cơm" can list Cơm chiên first and
// "rice" Cháo (its alias says "rice soup") — fine when the user picks from a
// list, wrong when the text is mapped straight to one row. Search-only data,
// never displayed (same status as foodSearchAliases.ts).
//
// The user's own data still wins: a food they logged recently, typed in
// themselves ("Của tôi") or imported ("Nguồn của tôi") stays first.
const STAPLES: Record<string, string> = {
  com: 'rice_white_cooked',
  rice: 'rice_white_cooked',
  reis: 'rice_white_cooked',
  trung: 'egg_chicken',
  'trung ga': 'egg_chicken',
  egg: 'egg_chicken',
  eggs: 'egg_chicken',
  ei: 'egg_chicken',
  eier: 'egg_chicken',
  sua: 'milk_whole',
  milk: 'milk_whole',
  milch: 'milk_whole',
  'banh mi': 'bread_baguette',
  bread: 'bread_baguette',
  brot: 'bread_baguette',
  ga: 'chicken_breast',
  'thit ga': 'chicken_breast',
  chicken: 'chicken_breast',
  hahnchen: 'chicken_breast',
  haehnchen: 'chicken_breast',
  'thit bo': 'beef_lean',
  beef: 'beef_lean',
  rindfleisch: 'beef_lean',
  'thit heo': 'pork_lean',
  'thit lon': 'pork_lean',
  pork: 'pork_lean',
  schweinefleisch: 'pork_lean',
  'ca phe': 'coffee_black',
  coffee: 'coffee_black',
  kaffee: 'coffee_black',
  pho: 'dish_pho_bo',
};

// At most this many SQLite lookups per analysis (a long pasted list).
const MAX_LIBRARY_QUERIES = 60;

export function searchForMealText(
  query: string,
  preferIds: ReadonlySet<string>,
  library: FoodItem[] = []
): FoodSearchResult {
  const result = searchFoods(query, { preferIds, library });
  const stapleId = STAPLES[normalize(query).replace(/\s+/g, ' ')];
  const staple: FoodItem | undefined = stapleId ? getAnyFoodById(stapleId) : undefined;
  const first = result.matches[0];
  const kind = first ? foodSourceKind(first) : null;
  const usersOwn = first != null && (preferIds.has(first.id) || kind === 'mine' || kind === 'library');
  if (!staple || usersOwn) return result;
  return {
    matches: [staple, ...result.matches.filter((item) => item.id !== staple.id)],
    similar: result.similar.filter((item) => item.id !== staple.id),
  };
}

// "Nguồn của tôi" rows live in SQLite and are searched asynchronously, so
// before mapping, fetch candidates for every phrase the mapper may try — each
// row's names and their shorter forms ("bánh mì trứng" → "bánh mì" → "bánh").
// The pooled result goes to searchForMealText, whose scorer keeps only the
// rows that match the phrase at hand.
export async function loadLibraryCandidates(items: DecodedMealItem[]): Promise<FoodItem[]> {
  const queries = new Set<string>();
  for (const item of items) {
    for (const phrase of [item.foodQuery, item.fallbackQuery, item.altQuery]) {
      const words = (phrase ?? '').split(/\s+/).filter(Boolean);
      for (let n = words.length; n >= 1; n -= 1) queries.add(words.slice(0, n).join(' '));
    }
  }
  const found = await Promise.all([...queries].slice(0, MAX_LIBRARY_QUERIES).map(searchLibraryCandidates));
  const byId = new Map<string, FoodItem>();
  for (const item of found.flat()) byId.set(item.id, item);
  return [...byId.values()];
}
