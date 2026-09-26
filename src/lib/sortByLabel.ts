import { LOCALE_TAGS, type Language } from '../i18n/types';

// A–Z by an already-translated label, using the current language's alphabet
// (Vietnamese: D < Đ < E, accents after the bare letter; German: Ä with A).
// Case-insensitive; stable for equal labels.
export function sortByLabel<T>(items: T[], labelOf: (item: T) => string, language: Language): T[] {
  const collator = new Intl.Collator(LOCALE_TAGS[language], { sensitivity: 'base' });
  return [...items].sort((a, b) => collator.compare(labelOf(a), labelOf(b)));
}
