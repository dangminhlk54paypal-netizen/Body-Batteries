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
// in the hole or outside the ring (with a little slack for fingers).
export function slotAtPoint(
  x: number,
  y: number,
  count: number,
  geometry: RingGeometry = RING_GEOMETRY
): number | null {
  const c = geometry.size / 2;
  const dist = Math.hypot(x - c, y - c);
  const inner = geometry.radius - geometry.thickness / 2 - 10;
  const outer =
    geometry.radius + geometry.thickness / 2 + geometry.overflowGap + geometry.overflowThickness + 10;
  if (dist < inner || dist > outer) return null;
  const deg = ((Math.atan2(y - c, x - c) * 180) / Math.PI + 90 + 360) % 360;
  return Math.min(count - 1, Math.floor(deg / (360 / count)));
}
