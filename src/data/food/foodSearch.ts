import type { FoodItem } from '../../types/food';
import { FOOD_ITEMS } from './foodDatabase';
import { USDA_FOODS } from './usdaFoods';

// Merged, precomputed food search — replaces the old two-tab "Món Việt" /
// "Tra cứu USDA (EN)" picker with one search box that finds a food by its
// Vietnamese, English, OR German name (or category). German (`nameDe`) is
// search-only, for the user shopping in German supermarkets (Penny, REWE,
// Netto) — display stays Vietnamese-main/English-sub. See
// src/components/FoodLogModal.tsx for the UI that consumes this.
//
// The merged list is FOOD_ITEMS (Vietnamese dish catalog, 90 items) followed
// by USDA_FOODS (USDA ingredient catalog, 363 items) — a test in
// __tests__/foodSearch.test.ts guarantees their ids never collide.
export const ALL_FOODS: FoodItem[] = [...FOOD_ITEMS, ...USDA_FOODS];

// Number of leading entries in ALL_FOODS that come from the Vietnamese-dish
// catalog — used only to break search-ranking ties (Vietnamese first).
const VN_COUNT = FOOD_ITEMS.length;

// Strip Vietnamese diacritics + lowercase for accent-insensitive search.
// NFD decomposes precomposed letters (ơ, ắ, ệ, …) into base + combining
// marks (U+0300–U+036F), which we then drop. đ/Đ are NOT decomposed by NFD
// (they're independent Unicode letters, not base+diacritic), so they need an
// explicit replace. "Cơm trắng" -> "com trang", "Đậu" -> "dau".
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/ß/g, 'ss')
    .trim();
}

// German shoppers commonly type the ASCII "umlaut expansion" habit (a with
// umlaut -> ae, o with umlaut -> oe, u with umlaut -> ue, sharp-s -> ss)
// instead of just dropping the umlaut (which is what normalize() above does
// via NFD-stripping: o-umlaut -> o, not "oe"). Index BOTH forms so
// "broetchen", "brotchen" (and the accented original) all match the same
// row. Operates on the raw (accented) string, not the NFD-stripped one.
function expandUmlauts(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .trim();
}

// One precomputed, searchable entry per food.
interface SearchEntry {
  item: FoodItem;
  isVietnamese: boolean;
  normNameVi: string;
  normNameEn: string;
  // Lowercased Vietnamese name WITH diacritics kept — used to boost
  // diacritic-exact hits when the user types with accents (see below).
  rawNameVi: string;
  // Combined normalized text every query token is matched against.
  haystack: string;
}

const SEARCH_INDEX: SearchEntry[] = ALL_FOODS.map((item, index) => {
  const normNameVi = normalize(item.nameVi);
  const normNameEn = normalize(item.nameEn);
  const normCategory = normalize(item.category);
  // German name (search-only, never displayed) — indexed in both its
  // NFD-stripped form (umlauts dropped: o-umlaut -> o) and its
  // umlaut-expanded form (o-umlaut -> oe), covering both common ASCII
  // typing habits (see expandUmlauts() above).
  const normNameDe = normalize(item.nameDe ?? '');
  const expandedNameDe = expandUmlauts(item.nameDe ?? '');
  return {
    item,
    isVietnamese: index < VN_COUNT,
    normNameVi,
    normNameEn,
    rawNameVi: item.nameVi.toLowerCase(),
    haystack: `${normNameVi} ${normNameEn} ${normCategory} ${normNameDe} ${expandedNameDe}`,
  };
});

// Ranking tier for one entry against the (already normalized) whole query —
// lower is better. 0 = the name matches the query exactly, 1 = the name
// starts with the query (prefix), 2 = the query only occurs mid-string (in
// the name or the category). An empty query makes every entry tier 1 (every
// string "starts with" ''), which combined with the catalog tie-break below
// naturally produces "Vietnamese catalog first, then USDA" with no
// empty-query special case needed.
function nameTier(entry: SearchEntry, normQuery: string): number {
  if (entry.normNameVi === normQuery || entry.normNameEn === normQuery) return 0;
  if (entry.normNameVi.startsWith(normQuery) || entry.normNameEn.startsWith(normQuery)) return 1;
  return 2;
}

// Search the merged catalog. Every whitespace-separated token in the query
// must appear somewhere in an item's normalized haystack (nameVi + nameEn +
// category + nameDe, the latter in both its umlaut-dropped and
// umlaut-expanded forms), so "com trang" matches "Cơm trắng", "ca hoi" /
// "salmon" both match the same salmon row, and "broetchen" / "brotchen" both
// match "Brötchen". Ranking (exact/prefix before mid-string, Vietnamese
// catalog before USDA) considers only nameVi/nameEn — a German-only match
// still surfaces, just not boosted to the top tiers. Empty query returns
// everything, Vietnamese catalog first. O(items) per call over precomputed
// strings (453 items total — fast per keystroke).
export function searchAllFoods(query: string): FoodItem[] {
  const normQuery = normalize(query);
  const tokens = normQuery.split(/\s+/).filter(Boolean);

  const matches =
    tokens.length === 0
      ? SEARCH_INDEX
      : SEARCH_INDEX.filter((entry) => tokens.every((t) => entry.haystack.includes(t)));

  // When the query itself carries diacritics ("gà" ≠ "ga"), the user has told
  // us exactly which word they mean — rank names that match with diacritics
  // intact above accent-stripped coincidences (otherwise "gà" would list
  // "gạo …" rice rows, whose stripped prefix "ga" wins, above the chicken
  // dishes the user is after). Accent-less queries are unaffected.
  const rawQuery = query.toLowerCase().trim();
  const rawTokens = rawQuery !== normQuery ? rawQuery.split(/\s+/).filter(Boolean) : [];
  const accentHit = (entry: SearchEntry): boolean =>
    rawTokens.length > 0 && rawTokens.every((t) => entry.rawNameVi.includes(t));

  return matches
    .map((entry) => ({ entry, tier: nameTier(entry, normQuery), accent: accentHit(entry) }))
    .sort((a, b) => {
      if (a.accent !== b.accent) return a.accent ? -1 : 1;
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.entry.isVietnamese !== b.entry.isVietnamese) return a.entry.isVietnamese ? -1 : 1;
      return 0; // stable sort: keep original catalog order for remaining ties
    })
    .map((ranked) => ranked.entry.item);
}
