import type { FoodItem } from '../../types/food';
import type { Language } from '../../i18n/types';
import { LANGUAGES } from '../../i18n/types';
import { useSettingsStore } from '../../store/settingsStore';
import { addCustomFoodAndRegister } from '../../data/food/customFoodRegistry';

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
    const translated = json?.responseData?.translatedText;
    return typeof translated === 'string' && translated.trim() ? translated.trim() : null;
  } catch {
    return null;
  }
}

// Fire-and-forget: call right after a NEW custom food is saved (never for
// catalog-backed foods — those already carry real translations, see
// AGENTS.md's foodDisplayName note). No-ops when the opt-in setting is off,
// the item isn't custom, the name is blank, or every translation call fails
// — the food is already saved either way; this only fills in the other name
// fields when it can, it never blocks or reverts the save.
//
// buildCustomFoodItem always files the raw typed text under nameVi
// regardless of what language it's actually in (see customFoodInput.ts) —
// `language` (the app's language when the food was saved) is the TRUE
// source language, so its own name field gets a copy of the raw text and
// the other 2 fields get machine-translated from it.
export async function autoTranslateCustomFoodName(
  item: FoodItem,
  language: Language
): Promise<void> {
  if (item.source !== 'custom') return;
  if (!useSettingsStore.getState().autoTranslateCustomFoodNames) return;

  const sourceText = item.nameVi.trim();
  if (!sourceText) return;

  const targets = LANGUAGES.filter((l) => l !== language);
  const translated = await Promise.all(
    targets.map((target) => translateText(sourceText, language, target))
  );

  const patch: Partial<FoodItem> = { [nameField(language)]: sourceText };
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
