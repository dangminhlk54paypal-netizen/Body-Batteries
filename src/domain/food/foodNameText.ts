import type { Language } from '../../i18n/types';
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

// ── Machine translation of custom food names ─────────────────────────────
// Free machine translation is unreliable for dish names — it translates word
// by word ("Bánh nướng tàu" → "Train pies", "Bánh mì thịt" → "loaf", "Canh chua
// cá" → "howler sour soup"). A wrong name is worse than no translation, so a
// custom food keeps ONE name in every language (the one the user typed)
// unless a translation passes the checks below. foodDisplayName already falls
// back to nameVi when nameEn/nameDe are empty.

// Letters only Vietnamese uses (horn/breve/circumflex vowels with tone marks,
// dot-below, hook-above, đ). Plain à/á/é… are left out: French, Spanish and
// German borrowings use them too ("Café").
const VIETNAMESE_ONLY =
  /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹĩũ]/i;
const GERMAN_ONLY = /[äöüß]/i;

export function looksVietnamese(text: string): boolean {
  return VIETNAMESE_ONLY.test(text.normalize('NFC'));
}

// The language a typed name is really in — not simply the app's language: a
// Vietnamese dish typed while the app is in English is still Vietnamese, and
// translating it "from English" produces garbage ("bánh n Schöpng tàu").
export function detectNameLanguage(text: string, fallback: Language): Language {
  if (looksVietnamese(text)) return 'vi';
  if (GERMAN_ONLY.test(text)) return 'de';
  return fallback;
}

// Vietnamese dishes known by their own name — kept as typed in every language
// instead of being translated word by word. Matched on the name's first word(s).
const KEEP_AS_IS_PREFIXES = [
  'bánh',
  'bún',
  'phở',
  'chè',
  'xôi',
  'nem',
  'chả',
  'gỏi',
  'hủ tiếu',
  'hủ tíu',
  'bò bía',
  'cao lầu',
  'mì quảng',
  'bột chiên',
  'cơm tấm',
];

function normalizeName(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isKeepAsIsName(text: string): boolean {
  const name = normalizeName(text);
  return KEEP_AS_IS_PREFIXES.some((p) => name === p || name.startsWith(`${p} `));
}

// Same name, ignoring case, punctuation, digits and spacing ("2.Xôi gấc" = "Xôi gấc").
export function sameNameLoosely(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}

// Whether a machine translation of a custom food name may be kept. Returns the
// translation, or null = keep the one typed name. `backTranslated` is the
// translation translated back into the source language: it must come back as
// the same name, otherwise meaning was lost ("Train pies" → "Bánh xe lửa").
export function acceptNameTranslation(input: {
  source: string;
  target: Language;
  translated: string | null;
  backTranslated: string | null;
}): string | null {
  const { source, target, translated, backTranslated } = input;
  if (!translated || !translated.trim()) return null;
  if (isKeepAsIsName(source)) return null;
  // An echo is not a translation — the one name already covers it.
  if (sameNameLoosely(translated, source)) return null;
  // Vietnamese letters in an English/German result = a mangled echo.
  if (target !== 'vi' && looksVietnamese(translated)) return null;
  if (!backTranslated || !sameNameLoosely(backTranslated, source)) return null;
  return translated.trim();
}

// Offline clean-up of names an earlier version stored from machine
// translation (custom foods only — a catalog food's names are real): a
// dish kept by its own name, or an English name full of Vietnamese letters,
// goes back to the one typed name. Returns the fixed item, or null if fine.
export function repairStoredTranslations(item: FoodItem): FoodItem | null {
  const nameEn = item.nameEn.trim();
  if (!nameEn || sameNameLoosely(nameEn, item.nameVi)) return null;
  // Typed in Vietnamese while the app was in English: the typed text landed in
  // nameEn and nameVi got a "translation" of it. The Vietnamese one is the name.
  if (looksVietnamese(nameEn)) {
    const nameVi = looksVietnamese(item.nameVi) ? item.nameVi : nameEn;
    return { ...item, nameVi, nameEn: '', nameDe: undefined };
  }
  if (isKeepAsIsName(item.nameVi)) return { ...item, nameEn: '', nameDe: undefined };
  return null;
}

// Renaming a custom food makes its old machine translations wrong — the new
// name is shown in every language (the edit flow does not re-translate).
export function namesAfterRename(item: FoodItem, newNameVi: string): Pick<FoodItem, 'nameVi' | 'nameEn' | 'nameDe'> {
  if (item.source !== 'custom' || sameNameLoosely(newNameVi, item.nameVi)) {
    return { nameVi: newNameVi, nameEn: item.nameEn, nameDe: item.nameDe };
  }
  return { nameVi: newNameVi, nameEn: '', nameDe: undefined };
}
