import { useCallback } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { translate } from './translate';
import type { Language } from './types';

type Vars = Record<string, string | number>;

// Subscribes to ONLY the `language` slice of settingsStore, so switching
// language re-renders exactly the components that call useT() — not the
// whole tree. This is what keeps language switching instant/jank-free (no
// Context provider wrapping the app, matching this codebase's existing
// no-Context convention — see src/lib/theme.ts).
export function useT() {
  const language = useSettingsStore((s) => s.language);
  const t = useCallback((key: string, vars?: Vars) => translate(language, key, vars), [language]);
  return { t, language };
}

// For components that only need the language (e.g. to pick an Intl locale
// tag) without a `t` function.
export function useLanguage(): Language {
  return useSettingsStore((s) => s.language);
}

// For non-component code (services, domain functions) that already receive
// `language` as an explicit parameter, use translate() directly. This
// getter is only for entry points that can't take a parameter (e.g. a
// background task) and must read the current value off the store directly.
export function getCurrentLanguage(): Language {
  return useSettingsStore.getState().language;
}
