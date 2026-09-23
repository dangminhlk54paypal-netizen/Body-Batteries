import type { IntakeEvent } from '../../types/battery';

// FIX #3: which intake_events rows count as MANUAL sub-battery quick-taps (the
// ones addIntake creates and removeIntake can undo), versus the derived rows
// logActivity/addCalories also write to the same table purely for the Excel
// export (steps / workout / calories) or that target the movement/energy
// batteries. Only the former belong in `intakeLog`.
export function isManualQuickTapIntake(event: IntakeEvent): boolean {
  if (event.batteryTypeId === 'movement' || event.batteryTypeId === 'energy') return false;
  if (event.note === 'steps' || event.note === 'calories') return false;
  if (event.note.startsWith('workout')) return false;
  return true;
}

// The row addCalories writes for a manually typed-in calorie amount
// (id `energy_<ts>`, batteryTypeId 'energy'). Its `note` is the caller's free
// text (falling back to 'calories'), so the id prefix is the only reliable
// discriminator — logActivity's derived energy rows are `workout_<ts>_<i>`.
export function isManualCalorieIntake(event: IntakeEvent): boolean {
  return event.batteryTypeId === 'energy' && event.id.startsWith('energy_');
}
