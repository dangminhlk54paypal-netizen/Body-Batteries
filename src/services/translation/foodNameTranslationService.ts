import type { FoodItem } from '../../types/food';
import type { Language } from '../../i18n/types';
import { LANGUAGES } from '../../i18n/types';
import { useSettingsStore } from '../../store/settingsStore';
import {
  addCustomFoodAndRegister,
  getCustomFoodByIdSync,
  getCustomFoods,
  updateCustomFoodNamesAndRegister,
} from '../../data/food/customFoodRegistry';
import { getAllOverridesSync, upsertOverrideAndRegister } from '../../data/food/foodOverrideRegistry';
import {
  acceptNameTranslation,
  decodePercentEncodedText,
  detectNameLanguage,
  isKeepAsIsName,
  sameNameLoosely,
} from '../../domain/food/foodNameText';

// Free, no-signup translation API (5,000 words/day anonymous — plenty for
// occasional custom-food saves). See the design discussion this opt-in
// feature came out of: MyMemory was chosen over DeepL/Google/LibreTranslate
// because it needs no API key/account and can be called straight from the
// app (no backend proxy), keeping the app's zero-new-runtime-dependency
// stance for i18n intact — this only adds a plain fetch() call.
const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';

function nameField(lang: Language): 'nameVi' | 'nameEn' | 'nameDe' {
  return lang === 'vi' ? 'nameVi' : lang === 'en' ? 'nameEn' : 'nameDe';
}

// One MyMemory call. Best-effort: any network/parse failure or empty result
// resolves to null rather than throwing — callers treat "couldn't translate"
// the same as "not translated yet" (the existing, pre-this-feature state).
export async function translateText(
  text: string,
  source: Language,
  target: Language
): Promise<string | null> {
  try {
    const url = `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    // MyMemory reports quota/invalid-pair errors with HTTP 200 but a non-200
    // responseStatus, putting the ERROR MESSAGE in translatedText ("MYMEMORY
    // WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS…") — never save that
    // as a food name.
    const status = json?.responseStatus;
    if (status !== undefined && Number(status) !== 200) return null;
    const translated = json?.responseData?.translatedText;
    if (typeof translated !== 'string') return null;
    // When it can't translate, MyMemory can echo the query back still
    // URL-encoded ("Fischst%C3%A4bchen%20Berida") — decode before saving.
    const cleaned = decodePercentEncodedText(translated.trim());
    return cleaned ? cleaned : null;
  } catch {
    return null;
  }
}

// A food NAME translated only if it survives the round trip: the result is
// translated back and must come back as the same name (see
// acceptNameTranslation) — word-by-word garbage like "Bánh nướng tàu" →
// "Train pies" (→ "Bánh xe lửa") is refused, and the food keeps its one
// typed name in every language. Two calls per target; null = keep the name.
export async function translateFoodName(text: string, source: Language, target: Language): Promise<string | null> {
  if (isKeepAsIsName(text)) return null;
  const translated = await translateText(text, source, target);
  if (!translated || sameNameLoosely(translated, text)) return null;
  const backTranslated = await translateText(translated, target, source);
  return acceptNameTranslation({ source: text, target, translated, backTranslated });
}

// Fire-and-forget: call right after a NEW custom food is saved (never for
// catalog-backed foods — those already carry real translations, see
// AGENTS.md's foodDisplayName note). No-ops when the opt-in setting is off,
// the item isn't custom, the name is blank, or every translation call fails
// — the food is already saved either way; this only fills in the other name
// fields when it can, it never blocks or reverts the save.
//
// buildCustomFoodItem always files the raw typed text under nameVi
// regardless of what language it's actually in (see customFoodInput.ts). The
// source language is what the text itself is written in (Vietnamese letters →
// vi, umlauts → de), else `language` (the app's language when it was saved):
// its own name field gets a copy of the raw text, and the other fields get a
// translation only when one passes translateFoodName's checks — otherwise they
// stay empty and every language shows the one typed name.
export async function autoTranslateCustomFoodName(
  item: FoodItem,
  language: Language
): Promise<void> {
  if (item.source !== 'custom') return;
  if (!useSettingsStore.getState().autoTranslateCustomFoodNames) return;

  const sourceText = item.nameVi.trim();
  if (!sourceText || isKeepAsIsName(sourceText)) return;

  const source = detectNameLanguage(sourceText, language);
  const targets = LANGUAGES.filter((l) => l !== source);
  const translated = await Promise.all(
    targets.map((target) => translateFoodName(sourceText, source, target))
  );

  const patch: Partial<FoodItem> = { [nameField(source)]: sourceText };
  targets.forEach((target, i) => {
    const result = translated[i];
    if (result) patch[nameField(target)] = result;
  });

  if (Object.keys(patch).length <= 1) return; // nothing new translated

  try {
    // Never awaited by the caller (fire-and-forget) — must not throw, or it
    // becomes an unhandled promise rejection. A failed save here just means
    // the names stay as they were; the food itself was already saved.
    await addCustomFoodAndRegister({ ...item, ...patch });
  } catch (e) {
    console.warn('autoTranslateCustomFoodName: failed to save translated names:', e);
  }
}

// One-time re-check (per install) of English names that an earlier version
// saved from machine translation WITHOUT the round-trip check. Each custom
// food's stored nameEn is translated back; if it does not come back as the
// food's name ("howler sour soup" → "canh chua cá hú" ≠ "Canh chua cá"), the
// English name is dropped and the one typed name is shown everywhere. Covers
// overrides of custom foods too (their name wins at lookup). The obvious cases
// were already fixed offline at startup (repairStoredTranslations).
//
// Only when the user has auto-translate ON (it sends names to MyMemory). Any
// network failure stops the pass without marking it done, so it resumes on a
// later start. Never throws (fire-and-forget from App.tsx).
export async function recheckStoredFoodTranslations(): Promise<void> {
  const settings = useSettingsStore.getState();
  if (!settings.autoTranslateCustomFoodNames || settings.foodNameTranslationsCheckedV1) return;
  try {
    const needsCheck = (f: FoodItem) => f.nameEn.trim() !== '' && !sameNameLoosely(f.nameEn, f.nameVi);
    for (const food of getCustomFoods().filter(needsCheck)) {
      const back = await translateText(food.nameEn, 'en', 'vi');
      if (back == null) return; // offline / quota — try again next start
      if (!sameNameLoosely(back, food.nameVi)) await updateCustomFoodNamesAndRegister(food.id, food.nameVi, '');
    }
    const customOverrides = getAllOverridesSync().filter((o) => getCustomFoodByIdSync(o.id) && needsCheck(o));
    for (const o of customOverrides) {
      const back = await translateText(o.nameEn, 'en', 'vi');
      if (back == null) return;
      if (!sameNameLoosely(back, o.nameVi)) await upsertOverrideAndRegister({ ...o, nameEn: '', nameDe: undefined });
    }
    useSettingsStore.setState({ foodNameTranslationsCheckedV1: true });
  } catch (e) {
    console.warn('recheckStoredFoodTranslations failed:', e);
  }
}
