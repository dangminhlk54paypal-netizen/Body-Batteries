import { darkColors } from './theme';

// Colour of the app-wide ambient background glow (AmbientBackground.tsx),
// following the headline fullness battery: low → coral, half → amber,
// full → mint. Blended smoothly between those anchors so the glow drifts as
// the battery drains instead of jumping at a threshold. Always the bright
// (dark-theme) status hues: the light theme's are darkened for text contrast
// and turn muddy as a soft glow.
const ANCHORS: { pct: number; color: string }[] = [
  { pct: 15, color: darkColors.statusLow },
  { pct: 45, color: darkColors.statusMid },
  { pct: 80, color: darkColors.statusGood },
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(v: number): string {
  return Math.round(v).toString(16).padStart(2, '0');
}

// Linear blend of two #rrggbb colours, t clamped to 0–1.
export function mixHex(a: string, b: string, t: number): string {
  const k = Math.min(1, Math.max(0, t));
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `#${[0, 1, 2].map((i) => toHex(ca[i] + (cb[i] - ca[i]) * k)).join('')}`;
}

export function ambientTint(satietyPct: number): string {
  const pct = Math.min(100, Math.max(0, satietyPct));
  const first = ANCHORS[0];
  const last = ANCHORS[ANCHORS.length - 1];
  if (pct <= first.pct) return first.color.toLowerCase();
  if (pct >= last.pct) return last.color.toLowerCase();
  const i = ANCHORS.findIndex((a) => a.pct >= pct);
  const lo = ANCHORS[i - 1];
  const hi = ANCHORS[i];
  return mixHex(lo.color, hi.color, (pct - lo.pct) / (hi.pct - lo.pct));
}
