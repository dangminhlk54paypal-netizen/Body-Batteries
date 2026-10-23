// Text folding shared by every food search: the in-memory catalog index
// (data/food/foodSearch.ts) and the SQLite-backed "Nguồn của tôi" library
// (data/food/libraryFoodRegistry.ts), which stores the folded names in a
// column and must fold the query the exact same way to find them.

// Strip Vietnamese diacritics + lowercase for accent-insensitive search.
// NFD decomposes precomposed letters (ơ, ắ, ệ, …) into base + combining
// marks (U+0300–U+036F), which we then drop. đ/Đ are NOT decomposed by NFD
// (they're independent Unicode letters, not base+diacritic), so they need an
// explicit replace. "Cơm trắng" -> "com trang", "Đậu" -> "dau".
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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
export function expandUmlauts(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .trim();
}

// The searchable words of an already-normalized text.
export function wordsOf(text: string): string[] {
  return text.split(/[^a-z0-9]+/).filter(Boolean);
}
