import {
  applyActivityToDayReadings,
  reverseActivityOnDayReadings,
} from '../activityBackfillEngine';
import type { BatteryReading } from '../../../types/battery';
import type { ActivityLogEntry, UserProfile, WorkoutSession } from '../../../types/energy';

const PROFILE: UserProfile = {
  weightKg: 70,
  heightCm: 175,
  age: 30,
  sex: 'male',
  occupation: 'sedentary',
};

function reading(overrides: Partial<BatteryReading> = {}): BatteryReading {
  return {
    date: '2026-07-05',
    batteryTypeId: 'movement',
    level: 0,
    capacity: 8000,
    ...overrides,
  };
}

function activityLogEntry(overrides: Partial<ActivityLogEntry> = {}): ActivityLogEntry {
  return {
    id: 'activity_1_test',
    timestamp: 1,
    steps: 0,
    workouts: [],
    energyKcal: 200,
    satietyDrainKcal: 0,
    energyDayApplied: '2026-07-05',
    movementStepsApplied: 3000,
    ...overrides,
  };
}

describe('applyActivityToDayReadings', () => {
  it('grows the energy reading capacity/activityBonusKcal via growGoalFromActivity', () => {
    const readings: BatteryReading[] = [
      reading({ batteryTypeId: 'energy', level: 0, capacity: 2000 }),
    ];
    const result = applyActivityToDayReadings(readings, PROFILE, 3000, []);
    // stepsKcal(3000, 70) = round(3000 * 0.0005 * 70) = 105
    expect(result[0].capacity).toBe(2105);
    expect(result[0].activityBonusKcal).toBe(105);
    expect(result[0].level).toBe(0); // eaten-so-far is untouched
  });

  it('never touches satietyReserveKcal/lastSatietySyncAt on the energy reading', () => {
    const readings: BatteryReading[] = [
      reading({
        batteryTypeId: 'energy',
        level: 500,
        capacity: 2000,
        satietyReserveKcal: 1234,
        lastSatietySyncAt: 999,
      }),
    ];
    const result = applyActivityToDayReadings(readings, PROFILE, 0, [
      { type: 'running', minutes: 30 } as WorkoutSession,
    ]);
    expect(result[0].satietyReserveKcal).toBe(1234);
    expect(result[0].lastSatietySyncAt).toBe(999);
    // the goal DID grow — confirms the charge actually ran, not a no-op.
    expect(result[0].capacity).toBeGreaterThan(2000);
  });

  it('charges the movement battery by steps + workout step-equivalents', () => {
    const readings: BatteryReading[] = [reading({ level: 1000, capacity: 8000 })];
    const workouts: WorkoutSession[] = [{ type: 'running', minutes: 30 }];
    const result = applyActivityToDayReadings(readings, PROFILE, 2000, workouts);
    // running is vigorous -> 130 steps/min * 30min = 3900 step-equivalent
    expect(result[0].level).toBe(1000 + 2000 + 3900);
  });

  it('clamps the movement charge at the battery capacity', () => {
    const readings: BatteryReading[] = [reading({ level: 7000, capacity: 8000 })];
    const result = applyActivityToDayReadings(readings, PROFILE, 5000, []);
    expect(result[0].level).toBe(8000);
  });

  it('leaves readings with no matching battery untouched', () => {
    const readings: BatteryReading[] = [
      reading({ batteryTypeId: 'protein', level: 10, capacity: 120 }),
      reading({ batteryTypeId: 'sleep', level: 4, capacity: 8 }),
    ];
    const result = applyActivityToDayReadings(readings, PROFILE, 3000, []);
    expect(result).toEqual(readings);
  });

  it('does not mutate the input readings array', () => {
    const original = reading({ level: 1000, capacity: 8000 });
    applyActivityToDayReadings([original], PROFILE, 3000, []);
    expect(original.level).toBe(1000);
  });
});

describe('reverseActivityOnDayReadings', () => {
  it('is the exact round-trip inverse of applyActivityToDayReadings (no clamping hit)', () => {
    const before: BatteryReading[] = [
      reading({ batteryTypeId: 'movement', level: 1000, capacity: 8000 }),
      reading({
        batteryTypeId: 'energy',
        level: 500,
        capacity: 2000,
        activityBonusKcal: 0,
        satietyReserveKcal: 777,
        lastSatietySyncAt: 42,
      }),
    ];
    const steps = 3000;
    const workouts: WorkoutSession[] = [];
    const charged = applyActivityToDayReadings(before, PROFILE, steps, workouts);
    const entry = activityLogEntry({
      steps,
      workouts,
      energyKcal: charged.find((r) => r.batteryTypeId === 'energy')!.activityBonusKcal!,
      movementStepsApplied: steps,
    });
    const reversed = reverseActivityOnDayReadings(charged, entry);
    expect(reversed).toEqual(before);
  });

  it('reverses the energy goal growth, floored at 0', () => {
    const readings: BatteryReading[] = [
      reading({ batteryTypeId: 'energy', level: 100, capacity: 300, activityBonusKcal: 100 }),
    ];
    const entry = activityLogEntry({ energyKcal: 300 });
    const result = reverseActivityOnDayReadings(readings, entry);
    expect(result[0].capacity).toBe(0); // floored
    expect(result[0].activityBonusKcal).toBe(0); // floored
  });

  it('never touches satietyReserveKcal/lastSatietySyncAt on the energy reading', () => {
    const readings: BatteryReading[] = [
      reading({
        batteryTypeId: 'energy',
        level: 500,
        capacity: 2000,
        satietyReserveKcal: 1234,
        lastSatietySyncAt: 999,
      }),
    ];
    const entry = activityLogEntry({ energyKcal: 200 });
    const result = reverseActivityOnDayReadings(readings, entry);
    expect(result[0].satietyReserveKcal).toBe(1234);
    expect(result[0].lastSatietySyncAt).toBe(999);
  });

  it('falls back to entry.steps when movementStepsApplied is missing (pre-migration rows)', () => {
    const readings: BatteryReading[] = [reading({ level: 1000, capacity: 8000 })];
    const entry = activityLogEntry({ steps: 400, movementStepsApplied: undefined });
    const result = reverseActivityOnDayReadings(readings, entry);
    expect(result[0].level).toBe(600);
  });

  it('does not mutate the input readings array', () => {
    const original = reading({ level: 1000, capacity: 8000 });
    reverseActivityOnDayReadings([original], activityLogEntry({ movementStepsApplied: 200 }));
    expect(original.level).toBe(1000);
  });
});
