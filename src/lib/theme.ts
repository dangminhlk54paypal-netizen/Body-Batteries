// Two palettes for the app's dark/light theme toggle. `darkColors` is
// byte-identical to the original single palette that used to be hardcoded
// inline across src/components and src/screens (see AGENTS.md-adjacent UI
// upgrade plan, P0). `lightColors` is the light counterpart, matching every
// key in `ThemeColors` so `tsc` catches a missing token.
//
// No React Context here — the app has no Context/Provider convention (see
// docs/03-architecture.md § "🌐 Đa ngôn ngữ"). Theme mode lives in Zustand's
// settingsStore (`themeMode`) and is read via `useThemeColors()` (see
// src/hooks/useThemeColors.ts), mirroring how `useT()` reads `language`.
// Every component/screen calls that hook (or `useThemedStyles`) instead of
// importing a static palette directly.
//
// Per-battery-type colors (DEFAULT_BATTERIES / ENERGY_BATTERY in
// lib/constants.ts) are intentionally NOT tokenized here — they are
// semantic, data-driven identity colors for each battery type, not shared
// UI chrome.

export const darkColors = {
  // ── Backgrounds / surfaces ──────────────────────────────────────────────
  bg: '#0d0d1a',
  bgCard: '#1a1a2e',
  bgElevated: '#2d2d44',
  bgHighlight: '#16213e',
  bgAlt: '#26263d',

  // ── Borders / dividers ───────────────────────────────────────────────────
  border: '#444',
  borderSubtle: '#333',
  borderAlt: '#262640',
  divider: '#1e1e30',

  // ── Text ─────────────────────────────────────────────────────────────────
  // Ordered brightest → dimmest. There are this many tiers because the
  // pre-existing UI already used ~10 distinct grays, each with its own
  // contextual meaning (primary label vs. meta vs. placeholder vs. hint) —
  // collapsing any two of these would visibly change that screen.
  textPrimary: '#fff',
  textBright: '#eee',
  textLight: '#ddd',
  textSoft: '#ccc',
  textSecondary: '#aaa',
  textDim: '#999',
  textTertiary: '#888',
  textSubtle: '#777',
  textMuted: '#666',
  textFaint: '#555',
  textCool: '#5a5a7a', // MicroBatteryStack target caption — cooler-toned faint gray
  textPale: '#E0E0FF', // OnboardingScreen card header — near-white lavender tint

  // ── Accent / brand ───────────────────────────────────────────────────────
  accent: '#FFB020', // warm amber — primary action, energy/charging
  accentAlt: '#6C5CE7', // purple — secondary accent (diary, mode chips)
  accentAltLight: '#a29bfe',
  accentAltLighter: '#9E9EFE',
  accentAltBg: '#2d2d5e', // active-chip background paired with accentAlt border
  mint: '#4ECDC4',
  amber: '#FFB020',
  mealBreakfast: '#FFB347', // per-meal-type indicator color (Settings meal windows)
  trendNutrition: '#54A0FF', // blue — nutrition line/badge (đối lập với amber)
  trendEnergy: '#FFB020', // amber — energy line/badge

  // ── Semantic status ──────────────────────────────────────────────────────
  danger: '#FF6B6B', // soft/warm — deletions, over-burn move action
  dangerStrong: '#FF4757', // hard error — validation errors, destructive settings
  warning: '#FFD93D',
  info: '#54A0FF',
  infoAlt: '#0984e3',

  // Alpha-blended status backgrounds (History day-score badges)
  successBgSoft: '#7ED95722',
  warningBgSoft: '#FFD93D22',
  dangerBgSoft: '#FF475722',

  // ── Overdose notice (self-contained warm/brown warning card) ────────────
  overdoseBg: '#2a1f1a',
  overdoseBorder: '#5a4030',
  overdoseTitle: '#E17055',
  overdoseText: '#c9a892',
} as const;

// Widened to `string` per key (not the literal hex-union `typeof darkColors`
// would give via `as const`) so `lightColors` can hold its own different hex
// values while `tsc` still enforces the exact same *set of keys* — a missing
// or extra key in either palette fails the build.
export type ThemeColors = { [K in keyof typeof darkColors]: string };

export const lightColors: ThemeColors = {
  // ── Backgrounds / surfaces ──────────────────────────────────────────────
  bg: '#F5F5FA',
  bgCard: '#FFFFFF',
  bgElevated: '#E8E8F0',
  bgHighlight: '#EDF1FA',
  bgAlt: '#EFEFF5',

  // ── Borders / dividers ───────────────────────────────────────────────────
  border: '#CCC',
  borderSubtle: '#DDD',
  borderAlt: '#D5D5E5',
  divider: '#E5E5EE',

  // ── Text ─────────────────────────────────────────────────────────────────
  // Same tiers as darkColors, brightest→dimmest meaning darkest→lightest on
  // a white background (contrast order is inverted vs. the dark palette).
  textPrimary: '#14142B',
  textBright: '#1E1E38',
  textLight: '#2A2A44',
  textSoft: '#3C3C55',
  textSecondary: '#55556E',
  textDim: '#666680',
  textTertiary: '#75758C',
  textSubtle: '#858599',
  textMuted: '#9595A8',
  textFaint: '#A5A5B5',
  textCool: '#8888A5', // MicroBatteryStack target caption — cooler-toned faint gray
  textPale: '#3A3A6E', // OnboardingScreen card header — deep lavender on white

  // ── Accent / brand ───────────────────────────────────────────────────────
  accent: '#FFB020',
  accentAlt: '#6C5CE7',
  accentAltLight: '#a29bfe',
  accentAltLighter: '#9E9EFE',
  accentAltBg: '#E6E2FB', // active-chip background paired with accentAlt border
  mint: '#4ECDC4',
  amber: '#FFB020',
  mealBreakfast: '#FFB347',
  trendNutrition: '#2E7FE0', // darker blue for legibility on white
  trendEnergy: '#D98A00', // darker amber for legibility on white

  // ── Semantic status ──────────────────────────────────────────────────────
  danger: '#FF6B6B',
  dangerStrong: '#FF4757',
  warning: '#C7900A', // original #FFD93D is unreadable on white — darkened
  info: '#54A0FF',
  infoAlt: '#0984e3',

  // Alpha-blended status backgrounds — bumped alpha slightly vs. dark's `22`
  // so they still read against a white card.
  successBgSoft: '#7ED95733',
  warningBgSoft: '#FFD93D33',
  dangerBgSoft: '#FF475733',

  // ── Overdose notice (self-contained warm/brown warning card) ────────────
  overdoseBg: '#FBEFE7',
  overdoseBorder: '#E0B79E',
  overdoseTitle: '#C05621',
  overdoseText: '#8A5A3B',
};
