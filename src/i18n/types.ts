// Supported app languages. 'vi' is the original/default language — the app
// was built Vietnamese-first, so every fallback in translate.ts falls back
// to 'vi', never to 'en'.
export type Language = 'vi' | 'en' | 'de';

export const LANGUAGES: Language[] = ['vi', 'en', 'de'];

// Native-script display names, used by the language picker itself (so a
// user who can't read the current language can still find their own).
export const LANGUAGE_NAMES: Record<Language, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  de: 'Deutsch',
};

// Intl/toLocaleString locale tags — used everywhere the app previously
// hardcoded 'vi-VN' for date/number formatting.
export const LOCALE_TAGS: Record<Language, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  de: 'de-DE',
};
