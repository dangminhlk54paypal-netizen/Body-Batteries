// Pure ml <-> L conversion + formatting for the water battery's display unit.
// The stored/charged value is ALWAYS ml (matches BatteryType.unit = 'ml' and
// every existing addIntake/logFood call site) — this is a display-only
// concern, so nothing outside the water-battery UI needs to know about it.

export type WaterDisplayUnit = 'ml' | 'l';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Formats an ml amount for display in the given unit, e.g. formatWaterAmount
// (1500, 'l') -> "1.5L", formatWaterAmount(1500, 'ml') -> "1500ml".
export function formatWaterAmount(ml: number, unit: WaterDisplayUnit): string {
  return unit === 'l' ? `${round1(ml / 1000)}L` : `${Math.round(ml)}ml`;
}

// Converts a user-typed amount (entered in the given unit) back to ml, the
// only unit addIntake/logFood ever charge in.
export function toMl(amount: number, unit: WaterDisplayUnit): number {
  return unit === 'l' ? amount * 1000 : amount;
}

export function nextWaterDisplayUnit(unit: WaterDisplayUnit): WaterDisplayUnit {
  return unit === 'ml' ? 'l' : 'ml';
}
