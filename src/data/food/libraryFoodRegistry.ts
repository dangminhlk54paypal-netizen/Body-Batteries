import type { FoodItem } from '../../types/food';
import type { LibrarySource } from '../../types/foodLibrary';
import { normalize, wordsOf } from '../../domain/food/searchNormalize';
import { librarySourceIdOf } from '../../domain/food/library/libraryMapping';

// Sync bridge for "Nguồn của tôi" (the user's imported food tables).
//
// Unlike custom foods, an imported table can hold hundreds of thousands of
// rows, so it is NOT mirrored in memory. Only two small things are:
//   - the list of sources (a handful of rows: names for the search badge,
//     on/off state), and
//   - a cache of the library foods actually in play — the ones meals in the
//     food log point at (loaded at startup) plus whatever the last searches
//     returned — so getAnyFoodById (foodLookup.ts), which every aggregation
//     path calls synchronously, resolves them.
// Search itself is an async SQLite query (searchLibraryCandidates).
//
// libraryFoodsRepository.ts (and expo-sqlite) is loaded LAZILY on first use,
// keeping this module — and foodLookup.ts / foodSearch.ts, which import it —
// loadable under plain Jest (same reason as customFoodRegistry.ts). It is a
// lazy `require` rather than that file's `await import()` because Jest here
// cannot run dynamic imports, and these async paths are unit-tested.
function repository(): typeof import('../repositories/libraryFoodsRepository') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../repositories/libraryFoodsRepository');
}

let sources: LibrarySource[] = [];
let cache: Map<string, FoodItem> = new Map();

// How many rows one search pulls from SQLite for the in-memory ranker.
const SEARCH_CANDIDATE_LIMIT = 60;

export function setLibrarySources(items: LibrarySource[]): void {
  sources = items;
}

export function getLibrarySources(): LibrarySource[] {
  return sources;
}

export function getLibrarySourceById(id: string): LibrarySource | undefined {
  return sources.find((s) => s.id === id);
}

// The source a library food came from, for its search badge.
export function getLibrarySourceOfFood(foodId: string): LibrarySource | undefined {
  const sourceId = librarySourceIdOf(foodId);
  return sourceId ? getLibrarySourceById(sourceId) : undefined;
}

export function getLibraryFoodByIdSync(id: string): FoodItem | undefined {
  return cache.get(id);
}

export function cacheLibraryFoods(items: FoodItem[]): void {
  for (const item of items) cache.set(item.id, item);
}

// For tests: start from an empty registry.
export function resetLibraryRegistry(): void {
  sources = [];
  cache = new Map();
}

// Foods of enabled sources matching every word of the query (accents and
// case ignored, like the catalog search). Empty query → nothing: a table of
// 100 000 rows is not something to list unasked. Results are cached so the
// food the user then picks resolves through getAnyFoodById.
export async function searchLibraryCandidates(query: string): Promise<FoodItem[]> {
  const words = wordsOf(normalize(query));
  if (words.length === 0 || !sources.some((s) => s.enabled)) return [];
  try {
    const { searchLibraryFoods } = repository();
    const items = await searchLibraryFoods(words, SEARCH_CANDIDATE_LIMIT);
    cacheLibraryFoods(items);
    return items;
  } catch (e) {
    console.warn('Library food search failed:', e);
    return [];
  }
}

// Called by the import once a source is written: a new source goes on top
// of the list, an existing one is replaced where it is — so search and the
// badge see it immediately.
export function registerLibrarySource(source: LibrarySource): void {
  sources = sources.some((s) => s.id === source.id)
    ? sources.map((s) => (s.id === source.id ? source : s))
    : [source, ...sources];
}

// After "↻ cập nhật nguồn" replaced a source's rows: forget its cached foods
// (their numbers may have changed) and re-cache the ones the food log still
// points at, from the new rows.
export async function refreshLibrarySourceInRegistry(source: LibrarySource): Promise<void> {
  registerLibrarySource(source);
  for (const foodId of [...cache.keys()]) {
    if (librarySourceIdOf(foodId) === source.id) cache.delete(foodId);
  }
  try {
    cacheLibraryFoods(await repository().getLoggedLibraryFoods());
  } catch (e) {
    console.warn('Failed to re-cache logged library foods:', e);
  }
}

export async function setLibrarySourceEnabledAndRegister(id: string, enabled: boolean): Promise<void> {
  const { setLibrarySourceEnabled } = repository();
  const updatedAt = Date.now();
  await setLibrarySourceEnabled(id, enabled, updatedAt);
  sources = sources.map((s) => (s.id === id ? { ...s, enabled, updatedAt } : s));
}

// Deletes the source and its foods, and drops them from the cache, so meals
// logged from it fall back to their frozen name (foodLogEntryDisplayName) —
// the same outcome as deleting a custom food.
export async function deleteLibrarySourceAndUnregister(id: string): Promise<void> {
  const { deleteLibrarySource } = repository();
  await deleteLibrarySource(id);
  sources = sources.filter((s) => s.id !== id);
  for (const foodId of [...cache.keys()]) {
    if (librarySourceIdOf(foodId) === id) cache.delete(foodId);
  }
}

// Startup hydration — call after initDatabase(). Defensive like the other
// food registries: a failure leaves the library empty, never blocks startup.
export async function loadLibraryIntoRegistry(): Promise<void> {
  try {
    const { getAllLibrarySources, getLoggedLibraryFoods } = repository();
    setLibrarySources(await getAllLibrarySources());
    cache = new Map();
    cacheLibraryFoods(await getLoggedLibraryFoods());
  } catch (e) {
    console.warn('Failed to load library foods into registry:', e);
  }
}
