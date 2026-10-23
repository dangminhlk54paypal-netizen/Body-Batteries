import { useEffect, useState } from 'react';
import type { FoodItem } from '../types/food';
import { searchLibraryCandidates } from '../data/food/libraryFoodRegistry';

// Rows of "Nguồn của tôi" matching what the user is typing, fetched from
// SQLite a moment after typing pauses. Hand the result to searchFoods(query,
// { library }) — it ranks them with the catalog's scorer, so rows left over
// from the previous keystroke that no longer match simply drop out.
const DEBOUNCE_MS = 200;

export function useLibrarySearch(query: string): FoodItem[] {
  const [items, setItems] = useState<FoodItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      searchLibraryCandidates(query).then((found) => {
        if (!cancelled) setItems(found);
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return query.trim() === '' ? [] : items;
}
