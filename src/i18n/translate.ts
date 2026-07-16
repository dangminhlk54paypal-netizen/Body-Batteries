import { vi } from './locales/vi';
import { en } from './locales/en';
import { de } from './locales/de';
import type { Language } from './types';

// `en`/`de` are typed against this in their own files, so `tsc` fails the
// build the moment a key exists in one locale but not another.
export type TranslationSchema = typeof vi;

const DICTIONARIES: Record<Language, TranslationSchema> = { vi, en, de };

type Vars = Record<string, string | number>;

function getByPath(dict: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[part];
  }, dict);
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  );
}

// Dot-path lookup (e.g. 'settings.data.exportWeekly') against the current
// language's dictionary. Falls back to Vietnamese (the app's original,
// always-complete language) and finally to the raw key, so a missing
// translation degrades gracefully instead of crashing the UI.
export function translate(language: Language, key: string, vars?: Vars): string {
  const direct = getByPath(DICTIONARIES[language], key);
  const value = typeof direct === 'string' && direct !== '' ? direct : getByPath(DICTIONARIES.vi, key);
  if (typeof value !== 'string' || value === '') return key;
  return interpolate(value, vars);
}
