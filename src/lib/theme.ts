// Single, plain-object theme for the app's one (dark) visual style — no
// React Context/Provider, since there is no light/dark toggle to switch
// between. Every value here is byte-identical to what was previously
// hardcoded inline across src/components and src/screens; this file only
// gives those hex values names (see AGENTS.md-adjacent UI upgrade plan, P0).
//
// Per-battery-type colors (DEFAULT_BATTERIES / ENERGY_BATTERY in
// lib/constants.ts) are intentionally NOT tokenized here — they are
// semantic, data-driven identity colors for each battery type, not shared
// UI chrome.

export const colors = {
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
