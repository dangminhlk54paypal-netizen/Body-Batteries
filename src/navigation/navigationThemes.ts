import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { darkColors, lightColors } from '../lib/theme';

// React Navigation's own `theme` prop (screen background behind headers/tab
// bars, focused-tab tint, etc.) — kept in sync with our app palette so the
// chrome React Navigation renders (e.g. the tab bar) matches `darkColors`/
// `lightColors` from src/lib/theme.ts. Built on top of the library's own
// DarkTheme/DefaultTheme so every other token (fonts, etc.) stays sane.
export const appDarkNavigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: darkColors.bg,
    card: darkColors.bgCard,
    text: darkColors.textPrimary,
    border: darkColors.border,
    primary: darkColors.accent,
  },
};

export const appLightNavigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: lightColors.bg,
    card: lightColors.bgCard,
    text: lightColors.textPrimary,
    border: lightColors.border,
    primary: lightColors.accent,
  },
};
