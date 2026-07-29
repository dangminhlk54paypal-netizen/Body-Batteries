import type { FoodLogEntry } from '../../types/food';
import type { ActivityLogEntry } from '../../types/energy';
import type { IntakeEvent, BatteryId } from '../../types/battery';

// True "logged today" totals for the sub-batteries, independent of each
// reading's simulated hour-by-hour drain (battery_readings.level decays
// throughout the day — see energyStore.tickDrain/batteryEngine.applyDrain,
// correct for the "reserve remaining" pin metaphor, but wrong wherever the UI
// wants to show what was actually eaten/logged today: a pin read late in the
// day would otherwise show a much smaller number than what was really eaten,
// reading as a bug rather than the intended depletion effect).

export interface DailyBatteryTotals {
  protein: number; // g
  carbs: number; // g
  minerals: number; // mg
  water: number; // ml
  sleep: number; // h
  movementSteps: number;
  movementKcal: number; // real kcal burned today (steps + workouts), not a walking-rate estimate
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function sumIntake(intakeLog: IntakeEvent[], batteryId: BatteryId): number {
  return intakeLog
    .filter((e) => e.batteryTypeId === batteryId)
    .reduce((s, e) => s + e.amount, 0);
}

export function computeDailyBatteryTotals(
  foodLog: FoodLogEntry[],
  activityLog: ActivityLogEntry[],
  intakeLog: IntakeEvent[]
): DailyBatteryTotals {
  let proteinG = 0;
  let carbG = 0;
  let mineralsMg = 0;
  let waterG = 0;
  for (const f of foodLog) {
    proteinG += f.proteinG;
    carbG += f.carbG;
    mineralsMg += f.mineralsMg;
    waterG += f.waterG;
  }

  let movementSteps = 0;
  let movementKcal = 0;
  for (const e of activityLog) {
    movementSteps += e.movementStepsApplied ?? e.steps;
    movementKcal += e.energyKcal;
  }

  return {
    protein: round1(proteinG + sumIntake(intakeLog, 'protein')),
    carbs: round1(carbG + sumIntake(intakeLog, 'carbs')),
    minerals: Math.round(mineralsMg + sumIntake(intakeLog, 'minerals')),
    water: Math.round(waterG + sumIntake(intakeLog, 'water')),
    sleep: round1(sumIntake(intakeLog, 'sleep')),
    movementSteps: Math.round(movementSteps),
    movementKcal: Math.round(movementKcal),
  };
}
