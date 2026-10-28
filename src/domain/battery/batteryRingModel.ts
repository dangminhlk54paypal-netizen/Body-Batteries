// Geometry for the Home "pin nhỏ" ring: the 6 sub-batteries as equal slots
// around one circle. Inside its slot each coloured arc is as long as TODAY'S
// intake / daily target (protein 120/180 g → two-thirds of the slot); past
// 100 % the slot is full and the surplus shows as a thin arc just OUTSIDE the
// ring (water 4 L / 3.5 L → a short outer arc), capped at one extra slot.
// Pure — the component supplies colours, labels and tap handling.

import type { DailyBatteryTotals } from './dailyBatteryTotals';

export interface RingGeometry {
  size: number; // square viewBox side
  radius: number; // centre-line radius of the main ring
  thickness: number; // main ring stroke width
  overflowGap: number; // space between ring and overflow arc
  overflowThickness: number;
  gapDeg: number; // empty angle between neighbouring slots
}

export const RING_GEOMETRY: RingGeometry = {
  size: 220,
  radius: 78,
  thickness: 20,
  overflowGap: 4,
  overflowThickness: 6,
  gapDeg: 6,
};

// The small corner ring (micronutrients when there are more than 3).
export const MINI_RING_GEOMETRY: RingGeometry = {
  size: 76,
  radius: 28,
  thickness: 8,
  overflowGap: 2,
  overflowThickness: 3,
  gapDeg: 8,
};

export interface RingSlot {
  startDeg: number; // 0° = 12 o'clock, clockwise
  endDeg: number;
}

// Today's intake as a fraction of the daily target (1 = 100 %), per
// sub-battery id. Movement uses steps (its capacity unit), whatever the
// kcal/steps display toggle shows.
export function dailyBatteryRatio(
  id: string,
  totals: DailyBatteryTotals,
  capacity: number
): number {
  if (!(capacity > 0)) return 0;
  const amount: Record<string, number> = {
    protein: totals.protein,
    carbs: totals.carbs,
    minerals: totals.minerals,
    water: totals.water,
    sleep: totals.sleep,
    movement: totals.movementSteps,
  };
  return Math.max(0, (amount[id] ?? 0) / capacity);
}

export function ringSlots(count: number, gapDeg: number): RingSlot[] {
  const span = 360 / count;
  return Array.from({ length: count }, (_, i) => ({
    startDeg: i * span + gapDeg / 2,
    endDeg: (i + 1) * span - gapDeg / 2,
  }));
}

// The filled part of a slot and, past 100 %, the overflow part (null = none).
export function slotArcs(
  slot: RingSlot,
  ratio: number
): { fill: RingSlot | null; overflow: RingSlot | null } {
  const len = slot.endDeg - slot.startDeg;
  const fillLen = len * Math.min(ratio, 1);
  const overLen = len * Math.min(Math.max(ratio - 1, 0), 1);
  return {
    fill: fillLen > 0.5 ? { startDeg: slot.startDeg, endDeg: slot.startDeg + fillLen } : null,
    overflow: overLen > 0.5 ? { startDeg: slot.startDeg, endDeg: slot.startDeg + overLen } : null,
  };
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

// SVG path for a clockwise arc of radius r (drawn with a stroke).
export function arcPath(cx: number, cy: number, r: number, arc: RingSlot): string {
  const [x1, y1] = polar(cx, cy, r, arc.startDeg);
  const [x2, y2] = polar(cx, cy, r, arc.endDeg);
  const large = arc.endDeg - arc.startDeg > 180 ? 1 : 0;
  const f = (n: number) => n.toFixed(2);
  return `M ${f(x1)} ${f(y1)} A ${r} ${r} 0 ${large} 1 ${f(x2)} ${f(y2)}`;
}

// Which slot a tap at (x, y) — viewBox units — lands in, or null when it is
// in the hole or outside the ring (with a little slack for fingers). With the
// ring spun by rotationDeg (clockwise), the tap is turned back first.
export function slotAtPoint(
  x: number,
  y: number,
  count: number,
  geometry: RingGeometry = RING_GEOMETRY,
  rotationDeg = 0
): number | null {
  const c = geometry.size / 2;
  const dist = Math.hypot(x - c, y - c);
  const inner = geometry.radius - geometry.thickness / 2 - 10;
  const outer =
    geometry.radius + geometry.thickness / 2 + geometry.overflowGap + geometry.overflowThickness + 10;
  if (!(dist >= inner && dist <= outer)) return null; // NaN (no tap position) too
  const deg = ((((Math.atan2(y - c, x - c) * 180) / Math.PI + 90 - rotationDeg) % 360) + 360) % 360;
  return Math.min(count - 1, Math.floor(deg / (360 / count)));
}

// ── Wired labels around the big ring ────────────────────────────────────────
// Each metric's name · % · amount sits off the ring at the end of a thin
// "wire" plugged into the middle of its arc, like pins in a ball. The ring
// can be spun (the component adds the spin to every angle); the labels stay
// upright and glide round an ellipse: wide enough at the sides to clear the
// ring, taller at top/bottom, bulging a little on the diagonals so a label's
// corner never cuts the ring. Each label is pushed out from its anchor
// (right of it on the right side, above it at the top…), so the wire always
// ends at the label's edge or corner, never under its text.

export interface CalloutLayout {
  width: number;
  height: number;
  cx: number;
  cy: number;
  scale: number; // big ring drawn at RING_GEOMETRY.size × scale
  wireStart: number; // wires leave the ring this far from the centre
  rx: number; // label anchors sit on this ellipse (+ the diagonal bulge)
  ry: number;
  bulge: number;
  labelWidth: number;
  labelHeight: number;
  compact: boolean; // more than 8 labels: name + % only, no amount line
}

const CALLOUT_MIN_SIDE_WIRE = 12;
const CALLOUT_TOP_WIRE = 36;
const CALLOUT_COMPACT_TOP_WIRE = 30;
const CALLOUT_BULGE = 16;
// > 1 pushes a label fully to one side of its anchor well before 90°.
const CALLOUT_PUSH = 1.5;

export function slotMidDeg(index: number, count: number): number {
  'worklet';
  return ((index + 0.5) * 360) / count;
}

function pushOut(v: number): number {
  'worklet';
  return Math.max(-1, Math.min(1, v * CALLOUT_PUSH));
}

// Sized for a stage `width` wide; checked for 2–11 labels at every spin
// (batteryRingModel.test.ts): no two labels overlap, none touches the ring,
// none leaves the stage.
export function calloutLayout(width: number, count: number): CalloutLayout {
  const compact = count > 8;
  const labelWidth = count >= 10 ? 66 : 76;
  const labelHeight = compact ? 36 : 50;
  const ringOuter = RING_GEOMETRY.radius + RING_GEOMETRY.thickness / 2;
  const rx = Math.max(width / 2 - labelWidth, 0);
  const scale = Math.max(0.5, Math.min(1, (rx - CALLOUT_MIN_SIDE_WIRE) / ringOuter));
  const ry = ringOuter * scale + (compact ? CALLOUT_COMPACT_TOP_WIRE : CALLOUT_TOP_WIRE);
  // How far a label reaches above the centre, at worst, over every angle.
  let reach = 0;
  for (let d = 0; d <= 90; d += 1) {
    const r = (d * Math.PI) / 180;
    const c = Math.cos(r);
    reach = Math.max(reach, (ry + CALLOUT_BULGE * Math.abs(Math.sin(2 * r))) * c + (labelHeight * (1 + pushOut(c))) / 2);
  }
  const height = Math.ceil(2 * reach + 4);
  return {
    width,
    height,
    cx: width / 2,
    cy: height / 2,
    scale,
    wireStart: ringOuter * scale + 3,
    rx,
    ry,
    bulge: CALLOUT_BULGE,
    labelWidth,
    labelHeight,
    compact,
  };
}

// Where the wire at angle `deg` (0° = 12 o'clock, clockwise) leaves the ring
// and where it meets its label — stage coordinates.
export function calloutWire(deg: number, l: CalloutLayout): [number, number, number, number] {
  'worklet';
  const r = (deg * Math.PI) / 180;
  const s = Math.sin(r);
  const c = Math.cos(r);
  const b = l.bulge * Math.abs(Math.sin(2 * r));
  return [l.cx + l.wireStart * s, l.cy - l.wireStart * c, l.cx + l.rx * s, l.cy - (l.ry + b) * c];
}

// Top-left corner of the label box for the wire at angle `deg`.
export function calloutBox(deg: number, l: CalloutLayout): [number, number] {
  'worklet';
  const r = (deg * Math.PI) / 180;
  const s = Math.sin(r);
  const c = Math.cos(r);
  const b = l.bulge * Math.abs(Math.sin(2 * r));
  const x = l.cx + l.rx * s;
  const y = l.cy - (l.ry + b) * c;
  return [x - (l.labelWidth * (1 - pushOut(s))) / 2, y - (l.labelHeight * (1 + pushOut(c))) / 2];
}
