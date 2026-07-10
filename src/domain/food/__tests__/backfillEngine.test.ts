import {
  validateBackfillDate,
  applyFoodToDayReadings,
  reverseFoodOnDayReadings,
  buildReadingsForMissedDay,
} from '../backfillEngine';
import { dailyCalorieTarget } from '../../energy/weightGoal';
import { MODES } from '../../modes/modeDefinitions';
import type { BatteryReading } from '../../../types/battery';
import type { FoodLogEntry } from '../../../types/food';
import type { PortionNutrition } from '../foodNutrition';
import type { UserProfile } from '../../../types/energy';

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
    batteryTypeId: 'protein',
    level: 0,
    capacity: 120,
    ...overrides,
  };
}

function nutrition(overrides: Partial<PortionNutrition> = {}): PortionNutrition {
  return {
    energyKcal: 200,
    proteinG: 20,
    fatG: 5,
    carbG: 30,
    waterG: 50,
    mineralsMg: 10,
    ...overrides,
  };
}

function foodLogEntry(overrides: Partial<FoodLogEntry> = {}): FoodLogEntry {
  return {
    id: 'food_1_test',
    timestamp: 1,
    mealType: 'lunch',
    foodId: 'test_food',
    foodNameVi: 'Món test',
    grams: 100,
    energyKcal: 200,
    proteinG: 20,
    fatG: 5,
    carbG: 30,
    waterG: 50,
    mineralsMg: 10,
    ...overrides,
  };
}

describe('validateBackfillDate', () => {
  const today = '2026-07-10';

  it('rejects a future date', () => {
    expect(validateBackfillDate('2026-07-11', today)).toEqual({
      ok: false,
      reason: 'future',
    });
  });

  it('rejects a date older than maxDays (default DATA_RETENTION_DAYS)', () => {
    // today - 36 days, one past the default 35-day retention window.
    expect(validateBackfillDate('2026-06-04', today)).toEqual({
      ok: false,
      reason: 'too-old',
    });
  });

  it('accepts a date exactly maxDays ago', () => {
    // today - 35 days == the retention boundary itself, still legal.
    expect(validateBackfillDate('2026-06-05', today)).toEqual({ ok: true });
  });

  it('respects a custom maxDays override', () => {
    expect(validateBackfillDate('2026-07-05', today, 3)).toEqual({
      ok: false,
      reason: 'too-old',
    });
    expect(validateBackfillDate('2026-07-08', today, 3)).toEqual({ ok: true });
  });

  it('rejects a malformed date string', () => {
    expect(validateBackfillDate('not-a-date', today)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('rejects a calendar rollover (e.g. Feb 30th)', () => {
    expect(validateBackfillDate('2026-02-30', today)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('rejects a malformed today parameter too', () => {
    expect(validateBackfillDate('2026-07-09', 'garbage')).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('accepts yesterday', () => {
    expect(validateBackfillDate('2026-07-09', today)).toEqual({ ok: true });
  });

  it('accepts today itself', () => {
    expect(validateBackfillDate('2026-07-10', today)).toEqual({ ok: true });
  });
});

describe('applyFoodToDayReadings', () => {
  it('charges the matching nutrient batteries via applyIntake', () => {
    const readings: BatteryReading[] = [
      reading({ batteryTypeId: 'protein', level: 10, capacity: 120 }),
      reading({ batteryTypeId: 'carbs', level: 20, capacity: 250 }),
      reading({ batteryTypeId: 'water', level: 100, capacity: 2500 }),
      reading({ batteryTypeId: 'minerals', level: 5, capacity: 500 }),
    ];
    const result = applyFoodToDayReadings(readings, nutrition());

    expect(result.find((r) => r.batteryTypeId === 'protein')?.level).toBe(30);
    expect(result.find((r) => r.batteryTypeId === 'carbs')?.level).toBe(50);
    expect(result.find((r) => r.batteryTypeId === 'water')?.level).toBe(150);
    expect(result.find((r) => r.batteryTypeId === 'minerals')?.level).toBe(15);
  });

  it('charges the energy battery by energyKcal via chargeEnergy', () => {
    const readings: BatteryReading[] = [
      reading({ batteryTypeId: 'energy', level: 500, capacity: 2000 }),
    ];
    const result = applyFoodToDayReadings(readings, nutrition({ energyKcal: 300 }));
    expect(result[0].level).toBe(800);
  });

  it('NEVER touches satietyReserveKcal/lastSatietySyncAt on the energy reading', () => {
    const energyBefore = reading({
      batteryTypeId: 'energy',
      level: 500,
      capacity: 2000,
      satietyReserveKcal: 1234,
      lastSatietySyncAt: 999,
    });
    const result = applyFoodToDayReadings([energyBefore], nutrition({ energyKcal: 300 }));
    expect(result[0].satietyReserveKcal).toBe(1234);
    expect(result[0].lastSatietySyncAt).toBe(999);
    // the level DID change — confirms the charge actually ran, not a no-op.
    expect(result[0].level).toBe(800);
  });

  it('leaves readings with no matching battery untouched', () => {
    const readings: BatteryReading[] = [
      reading({ batteryTypeId: 'sleep', level: 4, capacity: 8 }),
      reading({ batteryTypeId: 'movement', level: 1000, capacity: 8000 }),
    ];
    const result = applyFoodToDayReadings(readings, nutrition());
    expect(result).toEqual(readings);
  });

  it('does not mutate the input readings array', () => {
    const original = reading({ batteryTypeId: 'protein', level: 10, capacity: 120 });
    applyFoodToDayReadings([original], nutrition());
    expect(original.level).toBe(10);
  });
});

describe('reverseFoodOnDayReadings', () => {
  it('is the exact round-trip inverse of applyFoodToDayReadings (no clamping hit)', () => {
    const before: BatteryReading[] = [
      reading({ batteryTypeId: 'protein', level: 10, capacity: 120 }),
      reading({ batteryTypeId: 'carbs', level: 20, capacity: 250 }),
      reading({ batteryTypeId: 'water', level: 100, capacity: 2500 }),
      reading({ batteryTypeId: 'minerals', level: 5, capacity: 500 }),
      reading({
        batteryTypeId: 'energy',
        level: 500,
        capacity: 2000,
        satietyReserveKcal: 777,
        lastSatietySyncAt: 42,
      }),
    ];
    const n = nutrition();
    const entry = foodLogEntry({
      energyKcal: n.energyKcal,
      proteinG: n.proteinG,
      carbG: n.carbG,
      waterG: n.waterG,
      mineralsMg: n.mineralsMg,
    });

    const charged = applyFoodToDayReadings(before, n);
    const reversed = reverseFoodOnDayReadings(charged, entry);

    expect(reversed).toEqual(before);
  });

  it('reverses the energy charge via burnEnergy, floored at 0', () => {
    const readings: BatteryReading[] = [
      reading({ batteryTypeId: 'energy', level: 100, capacity: 2000 }),
    ];
    const entry = foodLogEntry({ energyKcal: 300 });
    const result = reverseFoodOnDayReadings(readings, entry);
    expect(result[0].level).toBe(0); // floored, was only 100 kcal on the ledger
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
    const entry = foodLogEntry({ energyKcal: 200 });
    const result = reverseFoodOnDayReadings(readings, entry);
    expect(result[0].satietyReserveKcal).toBe(1234);
    expect(result[0].lastSatietySyncAt).toBe(999);
  });

  it('does not mutate the input readings array', () => {
    const original = reading({ batteryTypeId: 'protein', level: 30, capacity: 120 });
    reverseFoodOnDayReadings([original], foodLogEntry({ proteinG: 20 }));
    expect(original.level).toBe(30);
  });
});

describe('buildReadingsForMissedDay', () => {
  it('sizes nutrient battery capacities according to the given mode', () => {
    const { nutrients } = buildReadingsForMissedDay(
      '2026-07-01',
      '2026-07-01',
      PROFILE,
      MODES.training
    );
    const protein = nutrients.find((r) => r.batteryTypeId === 'protein');
    const water = nutrients.find((r) => r.batteryTypeId === 'water');
    expect(protein?.capacity).toBe(180); // 120 * 1.5 (training multiplier)
    expect(water?.capacity).toBe(3500); // 2500 * 1.4
  });

  it('keys every nutrient reading by the calendar date, starting at level 0', () => {
    const { nutrients } = buildReadingsForMissedDay(
      '2026-07-01',
      '2026-07-01',
      PROFILE,
      MODES.maintain
    );
    for (const r of nutrients) {
      expect(r.date).toBe('2026-07-01');
      expect(r.level).toBe(0);
    }
  });

  it('sizes the energy capacity from dailyCalorieTarget(profile)', () => {
    const { energy } = buildReadingsForMissedDay(
      '2026-07-01',
      '2026-07-01',
      PROFILE,
      MODES.maintain
    );
    expect(energy.capacity).toBe(dailyCalorieTarget(PROFILE).targetKcal);
  });

  it('keys the energy reading by the energy day, which can differ from the calendar date', () => {
    // The 0h-6am overlap (spec section 3c): a meal eaten late on the
    // calendar day still belongs to that day's energy ledger.
    const { energy, nutrients } = buildReadingsForMissedDay(
      '2026-07-10',
      '2026-07-09',
      PROFILE,
      MODES.maintain
    );
    expect(energy.date).toBe('2026-07-09');
    expect(nutrients[0].date).toBe('2026-07-10');
    expect(energy.batteryTypeId).toBe('energy');
    expect(energy.level).toBe(0);
  });

  it('leaves satietyReserveKcal/lastSatietySyncAt unset on the built energy reading', () => {
    const { energy } = buildReadingsForMissedDay(
      '2026-07-01',
      '2026-07-01',
      PROFILE,
      MODES.maintain
    );
    expect(energy.satietyReserveKcal).toBeUndefined();
    expect(energy.lastSatietySyncAt).toBeUndefined();
  });
});
