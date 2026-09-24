import type { FoodItem } from '../../types/food';

// Undoes URL percent-encoding that leaked into a food name — e.g.
// "Fischst%C3%A4bchen%20Berida" → "Fischstäbchen Berida".
//
// Where it comes from: the opt-in MyMemory auto-translate
// (foodNameTranslationService.ts) sometimes can't translate a name (typical
// case: a German brand name typed while the app is in Vietnamese) and then
// echoes the query back STILL URL-encoded. Those strings were saved verbatim
// as nameEn before this guard existed, so the same helper also repairs
// already-stored custom foods (see loadCustomFoodsIntoRegistry).
//
// Conservative on purpose — a name a person typed must never be mangled:
// - only touches text containing at least one `%XX` hex escape, so "50% fat"
//   or "Milk 1.5%" are left alone;
// - only when there is no raw whitespace, since an encoded string has none
//   (spaces become %20 or '+'), while a typed name with a stray "%2B" does;
// - malformed escapes make decodeURIComponent throw → original text returned.
export function decodePercentEncodedText(text: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(text) || /\s/.test(text)) return text;
  try {
    return decodeURIComponent(text.replace(/\+/g, ' ')).trim() || text;
  } catch {
    return text;
  }
}

// Returns a copy of `item` with every name field decoded, or null when no
// field needed it (so the caller knows whether anything must be persisted).
export function repairEncodedFoodNames(item: FoodItem): FoodItem | null {
  const nameVi = decodePercentEncodedText(item.nameVi);
  const nameEn = decodePercentEncodedText(item.nameEn);
  const nameDe = item.nameDe === undefined ? undefined : decodePercentEncodedText(item.nameDe);
  if (nameVi === item.nameVi && nameEn === item.nameEn && nameDe === item.nameDe) return null;
  return { ...item, nameVi, nameEn, ...(nameDe === undefined ? {} : { nameDe }) };
}
