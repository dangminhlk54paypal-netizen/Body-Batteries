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
  textCool: '#8282A2', // MicroBatteryStack target caption — cooler-toned faint gray.
  // Brightened from #5a5a7a (was 2.58:1 against bgCard, below WCAG AA) to
  // clear 4.5:1 — same hue/saturation, just lighter, since this token isn't
  // chained into the textPrimary…textFaint ladder below (used in exactly one
  // place) so there's no neighboring tier to collide with.
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
  // Strength-progress chart series (squat / bench / deadlift) — categorical
  // slots 1–3 of the dataviz reference palette, stepped for the dark card,
  // validated for colour-blind separation (always shown with S/B/D labels).
  liftSquat: '#3987e5',
  liftBench: '#d95926',
  liftDeadlift: '#199e70',

  // Weight-over-time chart reference lines (History → weight card): healthy
  // upper bound (BMI 24.9) and +10 / +20 / +35 kg above it, plus the soft
  // fill behind the whole healthy range (BMI 18.5–24.9).
  weightRefHealthy: '#7ED957',
  weightRefPlus10: '#FFD93D',
  weightRefPlus20: '#FF9F43',
  weightRefPlus35: '#FF4757',
  weightHealthyBand: '#7ED9571A',
  weightLine: '#54A0FF',
  // Weight list ▲/▼ versus ~7 days earlier: toward vs away from the healthy range.
  weightTrendToward: '#7ED957',
  weightTrendAway: '#FF6B6B',

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

  // ── Training log (Sổ tập) ───────────────────────────────────────────────
  // Month/block title (blue italic), week-heading weight (green italic), each
  // day's date (purple italic), movement labels S/B/D (bold grey). Dark mode
  // uses light, saturated stops so the four stay apart on #0d0d1a; the grey
  // sits well below the white body text so labels still read as labels.
  notebookPeriod: '#7DB3FF',
  notebookWeight: '#6FE3A0',
  notebookDate: '#CDB0FF',
  notebookLift: '#9A9AB5',
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
  textCool: '#737395', // MicroBatteryStack target caption — cooler-toned faint gray.
  // Darkened from #8888A5 (was 3.44:1 against white bgCard) to clear 4.5:1 —
  // same hue/saturation, just darker; standalone token, no ladder collision.
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
  liftSquat: '#2a78d6',
  liftBench: '#eb6834',
  liftDeadlift: '#1baf7a',

  // Darker stops than dark mode so thin dashed lines still read on white.
  weightRefHealthy: '#2E9E44',
  weightRefPlus10: '#C99A00',
  weightRefPlus20: '#E07B00',
  weightRefPlus35: '#D63031',
  weightHealthyBand: '#2E9E4414',
  weightLine: '#2E7FE0',
  weightTrendToward: '#2E9E44',
  weightTrendAway: '#D63031',

  // ── Semantic status ──────────────────────────────────────────────────────
  danger: '#FF6B6B',
  dangerStrong: '#FF4757',
  warning: '#986E08', // original #FFD93D unreadable on white — darkened once
  // already to #C7900A (2.83:1, still below WCAG AA), darkened again here to
  // clear 4.5:1 against white bgCard
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

  notebookPeriod: '#1A4DB3',
  notebookWeight: '#1B8A4B',
  notebookDate: '#7A3DC8',
  notebookLift: '#6E6E82',
};
