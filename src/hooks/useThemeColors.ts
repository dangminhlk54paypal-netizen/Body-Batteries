import { useMemo } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { useSettingsStore } from '../store/settingsStore';
import { darkColors, lightColors, resolveThemeMode, type ThemeColors } from '../lib/theme';

// The palette actually on screen ('dark' | 'light'), with 'system' resolved
// against the phone's current setting — re-renders when either changes.
export function useResolvedThemeMode(): 'dark' | 'light' {
  const mode = useSettingsStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  return resolveThemeMode(mode, systemScheme);
}

// Subscribes to ONLY the `themeMode` slice of settingsStore, so switching
// theme re-renders exactly the components that call useThemeColors() — not
// the whole tree. Mirrors useT()'s selector pattern for `language` (see
// src/i18n/useT.ts) — this codebase has no React Context/Provider by
// convention (see src/lib/theme.ts).
export function useThemeColors(): ThemeColors {
  return useResolvedThemeMode() === 'light' ? lightColors : darkColors;
}

// Style-factory helper: components define `(c: ThemeColors) => StyleSheet.create({...})`
// once at module scope, then call this inside the component to get themed
// styles that only recompute when the palette actually changes.
export function useThemedStyles<T>(factory: (c: ThemeColors) => T): T {
  const c = useThemeColors();
  return useMemo(() => factory(c), [factory, c]);
}

// Non-React entry points (background tasks, exports) that need a color value
// outside a component — mirrors i18n's getCurrentLanguage() pattern. Reads
// the store directly via getState(), no subscription.
export function getCurrentThemeColors(): ThemeColors {
  const mode = resolveThemeMode(useSettingsStore.getState().themeMode, Appearance.getColorScheme());
  return mode === 'light' ? lightColors : darkColors;
}
