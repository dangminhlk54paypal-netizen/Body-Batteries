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

// Like formatWaterAmount, but as a "drunk today/capacity" fraction, e.g.
// formatWaterRange(1500, 2500, 'l') -> "1.5/2.5L".
export function formatWaterRange(
  consumedMl: number,
  capacityMl: number,
  unit: WaterDisplayUnit
): string {
  return unit === 'l'
    ? `${round1(consumedMl / 1000)}/${round1(capacityMl / 1000)}L`
    : `${Math.round(consumedMl)}/${Math.round(capacityMl)}ml`;
}

// Converts a user-typed amount (entered in the given unit) back to ml, the
// only unit addIntake/logFood ever charge in.
export function toMl(amount: number, unit: WaterDisplayUnit): number {
  return unit === 'l' ? amount * 1000 : amount;
}

export function nextWaterDisplayUnit(unit: WaterDisplayUnit): WaterDisplayUnit {
  return unit === 'ml' ? 'l' : 'ml';
}

// Display-only preference for the movement/"Vận động" battery — like
// WaterDisplayUnit, this never changes the stored/charged amount (movement
// is always tracked in steps internally, matching BatteryType.unit), it
// only changes how the number is rendered (a kcal estimate, or the raw
// step count).
export type MovementDisplayUnit = 'kcal' | 'steps';

// Formats the movement pin's today-so-far reading for display. In steps mode
// this is a "walked today/capacity" fraction (both in steps, so no estimate
// involved); in kcal mode it's a single real kcal total — `kcalToday` is the
// caller-computed real kcal burned today (steps + workouts, e.g. summed from
// ActivityLogEntry.energyKcal), taken as a plain number so this file stays
// free of domain imports (lib must not depend on domain —
// docs/03-architecture.md layering rule). No kcal-mode fraction: capacity is
// only ever defined in steps, so a "capacity in kcal" would need the same
// walking-rate estimate this function used to rely on for the total itself —
// not worth trading the numerator's new accuracy for a synthetic denominator.
export function formatMovementAmount(
  stepsToday: number,
  stepsCapacity: number,
  kcalToday: number,
  unit: MovementDisplayUnit
): string {
  return unit === 'kcal'
    ? `≈${Math.round(kcalToday)} kcal`
    : `${Math.round(stepsToday)}/${Math.round(stepsCapacity)} bước`;
}

export function nextMovementDisplayUnit(unit: MovementDisplayUnit): MovementDisplayUnit {
  return unit === 'kcal' ? 'steps' : 'kcal';
}

// Parses a decimal typed on a comma-decimal keyboard. iPhones set to VI/DE
// locale show a comma as the decimal-pad's separator key (not a dot), so a
// plain parseFloat("79,4") silently truncates to 79 — this normalizes the
// comma to a dot first. Safe for dot-decimal input too ("79.4" is untouched).
export function parseDecimal(text: string): number {
  return parseFloat(text.trim().replace(',', '.'));
}
