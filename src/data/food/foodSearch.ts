import type { FoodItem } from '../../types/food';
import { FOOD_ITEMS } from './foodDatabase';
import { USDA_FOODS } from './usdaFoods';
import { getCustomFoods } from './customFoodRegistry';
import { FOOD_SEARCH_ALIASES } from './foodSearchAliases';
import { scoreCompact, scoreToken } from '../../domain/food/fuzzyMatch';
import type { TokenMatch } from '../../domain/food/fuzzyMatch';

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
export function normalize(s: string): string {
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
  order: number; // position in its index — the final tie-break (catalog order)
  normNameVi: string;
  normNameEn: string;
  // Lowercased Vietnamese name WITH diacritics kept — used to boost
  // diacritic-exact hits when the user types with accents (see below).
  rawNameVi: string;
  // Every word of the names, with how much a hit on it counts: the display
  // names fully, the German name almost, search-only aliases a bit less, the
  // category least (a category hit alone should not outrank a name hit).
  words: { word: string; weight: number }[];
  // Each name with its spaces removed ("pho bo" → "phobo"), for queries typed
  // run together or split differently.
  compacts: string[];
}

function wordsOf(text: string): string[] {
  return text.split(/[^a-z0-9]+/).filter(Boolean);
}

// Builds one precomputed search entry for a food item. Shared by the
// module-load-time catalog index below AND the per-call custom-food index
// (custom foods can be added mid-session, so they can't be precomputed once
// at module load like the build-time catalog).
function buildSearchEntry(item: FoodItem, isVietnamese: boolean, order: number): SearchEntry {
  const normNameVi = normalize(item.nameVi);
  const normNameEn = normalize(item.nameEn);
  // German name (search-only, never displayed) — indexed in both its
  // NFD-stripped form (umlauts dropped: o-umlaut -> o) and its
  // umlaut-expanded form (o-umlaut -> oe), covering both common ASCII
  // typing habits (see expandUmlauts() above).
  const normNameDe = normalize(item.nameDe ?? '');
  const expandedNameDe = expandUmlauts(item.nameDe ?? '');
  const aliases = normalize(FOOD_SEARCH_ALIASES[item.id] ?? '');

  const weights = new Map<string, number>();
  const add = (text: string, weight: number) => {
    for (const word of wordsOf(text)) weights.set(word, Math.max(weights.get(word) ?? 0, weight));
  };
  add(normNameVi, 1);
  add(normNameEn, 1);
  add(`${normNameDe} ${expandedNameDe}`, 0.95);
  add(aliases, 0.85);
  add(normalize(item.category), 0.6);

  return {
    item,
    isVietnamese,
    order,
    normNameVi,
    normNameEn,
    rawNameVi: item.nameVi.toLowerCase(),
    words: [...weights].map(([word, weight]) => ({ word, weight })),
    compacts: [normNameVi, normNameEn, normNameDe]
      .filter(Boolean)
      .map((n) => wordsOf(n).join('')),
  };
}

const SEARCH_INDEX: SearchEntry[] = ALL_FOODS.map((item, index) =>
  buildSearchEntry(item, index < VN_COUNT, index)
);

interface Ranked {
  entry: SearchEntry;
  // true = every word typed is really there (exact / prefix / inside a word),
  // or the whole query matches a name run together. false = only found by
  // allowing typos or by some of the words — "probably what you meant".
  strict: boolean;
  score: number;
  accent: boolean;
  coverage: number; // share of the typed words found at all (typos allowed)
}

function bestWordMatch(token: string, entry: SearchEntry): TokenMatch & { weighted: number } {
  let best = { score: 0, fuzzy: false, weighted: 0 };
  for (const { word, weight } of entry.words) {
    const m = scoreToken(token, word);
    if (m.score * weight > best.weighted) best = { ...m, weighted: m.score * weight };
    if (best.weighted >= 1) break;
  }
  return best;
}

function rankEntry(entry: SearchEntry, q: Query): Ranked | null {
  const accent = q.rawTokens.length > 0 && q.rawTokens.every((t) => entry.rawNameVi.includes(t));
  if (q.tokens.length === 0) return { entry, strict: true, score: 0, accent: false, coverage: 1 };

  const matches = q.tokens.map((t) => bestWordMatch(t, entry));
  const everyWordThere = matches.every((m, i) => !m.fuzzy && m.score >= (q.tokens[i].length === 1 ? 0.5 : 0.55));
  const tokenScore = matches.reduce((sum, m) => sum + m.weighted, 0) / matches.length;

  let compact: TokenMatch = { score: 0, fuzzy: false };
  for (const c of entry.compacts) {
    const m = scoreCompact(q.compact, c);
    if (m.score > compact.score) compact = m;
  }

  const strict = everyWordThere || (compact.score > 0 && !compact.fuzzy);
  let score = Math.max(tokenScore, compact.score);
  // Old tiers kept as bonuses: the whole name IS the query, or starts with it.
  if (entry.normNameVi === q.norm || entry.normNameEn === q.norm) score += 1;
  else if (entry.normNameVi.startsWith(q.norm) || entry.normNameEn.startsWith(q.norm)) score += 0.3;

  const coverage = compact.score > 0 ? 1 : matches.filter((m) => m.score > 0).length / matches.length;
  if (!strict) {
    const strongest = Math.max(...matches.map((m) => m.weighted));
    const plausible = score >= 0.5 || (matches.length >= 2 && coverage >= 0.5 && strongest >= 0.85);
    if (!plausible) return null;
  }
  return { entry, strict, score, accent, coverage };
}

interface Query {
  norm: string;
  tokens: string[];
  compact: string;
  rawTokens: string[];
}

function parseQuery(query: string): Query {
  const norm = normalize(query);
  const tokens = wordsOf(norm);
  // When the query itself carries diacritics ("gà" ≠ "ga"), the user has told
  // us exactly which word they mean — rank names that match with diacritics
  // intact above accent-stripped coincidences (otherwise "gà" would list
  // "gạo …" rice rows above the chicken dishes the user is after).
  // Accent-less queries are unaffected.
  const rawQuery = query.toLowerCase().trim();
  const rawTokens = rawQuery !== norm ? rawQuery.split(/\s+/).filter(Boolean) : [];
  return { norm, tokens, compact: tokens.join(''), rawTokens };
}

function compareRanked(prefer: Set<string>) {
  return (a: Ranked, b: Ranked): number => {
    if (a.accent !== b.accent) return a.accent ? -1 : 1;
    if (Math.abs(a.score - b.score) > 1e-9) return b.score - a.score;
    // Something the user has logged before wins a tie.
    const pa = prefer.has(a.entry.item.id);
    if (pa !== prefer.has(b.entry.item.id)) return pa ? -1 : 1;
    if (a.entry.isVietnamese !== b.entry.isVietnamese) return a.entry.isVietnamese ? -1 : 1;
    // Among equals, the shorter name is usually the plainer dish ("Phở bò"
    // before "Phô mai…" for "pho").
    if (a.entry.normNameVi.length !== b.entry.normNameVi.length) {
      return a.entry.normNameVi.length - b.entry.normNameVi.length;
    }
    return a.entry.order - b.entry.order;
  };
}

export interface FoodSearchResult {
  // Every word typed is in the name (accents, case and word order aside).
  matches: FoodItem[];
  // Close but not exact — a typo ("chiken"), words run together, or only some
  // of the words ("chicken noodle soup" → phở gà). Shown under their own small
  // heading, and only when there are few matches, so they never bury them.
  similar: FoodItem[];
}

// When at least this many exact matches exist, "similar" stays empty.
const SIMILAR_ONLY_BELOW = 5;
const SIMILAR_LIMIT = 6;

// The search box of the food log. Custom foods (the user's own, runtime
// registry) are ranked among themselves and listed BEFORE the built-in
// catalog, as before; `preferIds` (foods the user logged recently) win ties.
// Empty query returns everything, custom foods first, then Vietnamese
// catalog, then USDA.
export function searchFoods(query: string, opts: { preferIds?: Iterable<string> } = {}): FoodSearchResult {
  const q = parseQuery(query);
  const prefer = new Set(opts.preferIds ?? []);
  const compare = compareRanked(prefer);

  // Custom foods live in the runtime registry (can change mid-session), so
  // their search entries are built fresh per call — the list is small
  // (one user's own additions), so this stays cheap.
  const customIndex = getCustomFoods().map((item, i) => buildSearchEntry(item, true, i));
  const rank = (index: SearchEntry[]) =>
    index.map((e) => rankEntry(e, q)).filter((r): r is Ranked => r != null);
  const custom = rank(customIndex);
  const catalog = rank(SEARCH_INDEX);

  const seen = new Set<string>();
  const unique = (list: Ranked[]) =>
    list.filter((r) => {
      if (seen.has(r.entry.item.id)) return false;
      seen.add(r.entry.item.id);
      return true;
    });

  const matches = unique([
    ...custom.filter((r) => r.strict).sort(compare),
    ...catalog.filter((r) => r.strict).sort(compare),
  ]);
  // With some exact matches already listed, "similar" is only for near-misses
  // that have EVERY word (a typo in one); a food with only some of the words
  // is offered only when nothing matched exactly.
  const similar =
    q.tokens.length > 0 && matches.length < SIMILAR_ONLY_BELOW
      ? unique(
          [...custom, ...catalog].filter((r) => !r.strict && (matches.length === 0 || r.coverage === 1)).sort(compare)
        ).slice(0, SIMILAR_LIMIT)
      : [];
  return { matches: matches.map((r) => r.entry.item), similar: similar.map((r) => r.entry.item) };
}

// The exact matches only — every whitespace-separated token must be in a
// food's names (nameVi + nameEn + nameDe in both umlaut forms + search
// aliases + category), accents and case ignored: "com trang" matches "Cơm
// trắng", "ca hoi" / "salmon" the same salmon row, "broetchen" / "brotchen"
// both "Brötchen". See searchFoods for the typo-tolerant "similar" list.
export function searchAllFoods(query: string): FoodItem[] {
  return searchFoods(query).matches;
}
