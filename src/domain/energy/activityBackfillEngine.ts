// Pure engine for "cập nhật lịch sử" — backfilling a logged activity
// (steps/workouts) into a PAST day's readings. The activity counterpart of
// domain/food/backfillEngine.ts (same invariants, see that file's header).
// No I/O, no store: callers (energyStore.logActivityForPastDate/
// removeActivityForPastDate) own all persistence/day-lookup concerns.

import type { BatteryReading } from '../../types/battery';
import type { ActivityLogEntry, UserProfile, WorkoutSession } from '../../types/energy';
import { applyIntake, clampLevel } from '../battery/batteryEngine';
import { growGoalFromActivity } from './energyBalanceEngine';
import { totalStepEquivalent } from './metabolismEngine';

// Same fallback rule as energyStore.movementChargeOf (duplicated here on
// purpose — domain files must not import from the store layer): rows logged
// before movementStepsApplied existed only ever charged the pin by `steps`.
function movementChargeOf(entry: ActivityLogEntry): number {
  return entry.movementStepsApplied ?? entry.steps ?? 0;
}

// Charges one backfilled activity's effect into a day's readings:
//   - energy reading: grows the day's OWN goal via growGoalFromActivity —
//     the exact mirror of what energyStore.logActivity does for TODAY
//     (capacity/activityBonusKcal only, level/eaten-so-far untouched).
//   - movement reading: charges steps + workout step-equivalents via
//     applyIntake, same as logActivity's movement-pin charge.
// Deliberately never drains satietyReserveKcal (unlike logActivity, which
// also calls drainFromWorkout) — a backfilled workout's "makes you hungrier"
// effect has already worn off by the time it's entered, mirroring
// domain/food/backfillEngine.applyFoodToDayReadings' omission of
// eatIntoReserve for the same reason. growGoalFromActivity itself never
// touches satiety, so this invariant holds automatically.
export function applyActivityToDayReadings(
  readings: BatteryReading[],
  profile: UserProfile,
  steps: number,
  workouts: WorkoutSession[]
): BatteryReading[] {
  const movementCharge = steps + totalStepEquivalent(workouts);
  return readings.map((r) => {
    if (r.batteryTypeId === 'energy') {
      return growGoalFromActivity(r, profile, steps, workouts);
    }
    if (r.batteryTypeId === 'movement') {
      return movementCharge > 0 ? applyIntake(r, movementCharge) : r;
    }
    return r;
  });
}

// The exact inverse of applyActivityToDayReadings, using a logged
// ActivityLogEntry's own snapshot (energyKcal/movementStepsApplied) so
// reversal stays correct even if the profile/rates changed since it was
// logged. Mirrors domain/food/backfillEngine.reverseFoodOnDayReadings:
// simple subtraction (not the delta-over-clamped-total approach
// energyStore.removeActivity uses for TODAY's live pin, which additionally
// has to account for tickDrain/manual addIntake — neither of which ever
// touches a historical day's persisted reading). Never touches
// satietyReserveKcal, since the forward direction never drained it either.
export function reverseActivityOnDayReadings(
  readings: BatteryReading[],
  entry: ActivityLogEntry
): BatteryReading[] {
  const movementCharge = movementChargeOf(entry);
  return readings.map((r) => {
    if (r.batteryTypeId === 'energy') {
      return {
        ...r,
        capacity: Math.max(0, r.capacity - entry.energyKcal),
        activityBonusKcal: Math.max(0, (r.activityBonusKcal ?? 0) - entry.energyKcal),
      };
    }
    if (r.batteryTypeId === 'movement') {
      return movementCharge > 0
        ? { ...r, level: clampLevel(r.level - movementCharge, r.capacity) }
        : r;
    }
    return r;
  });
}
