import { useEnergyStore } from '../energyStore';
import { useSettingsStore } from '../settingsStore';
import type { BatteryReading } from '../../types/battery';
import type { FoodItem, FoodLogEntry } from '../../types/food';
import { todayString, dateString, energyDayString } from '../../lib/dateUtils';
import { dailyCalorieTarget } from '../../domain/energy/weightGoal';
import * as batteryRepository from '../../data/repositories/batteryRepository';
import * as foodLogRepository from '../../data/repositories/foodLogRepository';
import * as dailyLogRepository from '../../data/repositories/dailyLogRepository';

// Same test-environment shims as energyStore.test.ts (see the rationale
// there): keep the generated food catalogs, expo-sqlite and AsyncStorage out
// of the import chain.
jest.mock('../../data/food/foodLookup', () => ({ getAnyFoodById: jest.fn() }));
jest.mock('../../data/db/database', () => ({
  getDb: () => ({
    runAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn().mockResolvedValue([]),
    execAsync: jest.fn().mockResolvedValue(undefined),
    withTransactionAsync: jest.fn(async (cb: () => Promise<void>) => {
      await cb();
    }),
  }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// S-S4 invariants under test (spec section 4): backfilling a past day must
// leave every one of today's numbers untouched, must round-trip exactly on
// undo, must build fresh readings for a never-opened day, and must handle the
// 0h-6am overlap where the entry's energy-day IS the currently loaded one.

function makeFoodItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'test_food',
    nameVi: 'Món thử',
    nameEn: 'Test food',
    category: 'grain',
    defaultServingG: 100,
    servingPresets: [],
    per100g: {
      energyKcal: 200,
      waterG: 0,
      proteinG: 10,
      fatG: 5,
      carbG: 30,
      fiberG: 0,
      sugarG: 0,
      calciumMg: 0,
      ironMg: 0,
      sodiumMg: 0,
      potassiumMg: 0,
      magnesiumMg: 0,
      zincMg: 0,
    },
    source: 'test',
    note: '',
    ...overrides,
  };
}

// Noon `daysBack` days ago — noon keeps the entry's calendar day and energy
// day equal (the plain, non-overlap case).
function pastNoonTimestamp(daysBack: number): number {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

function seedTodayReadings() {
  useEnergyStore.setState({
    readings: [
      {
        date: energyDayString(),
        batteryTypeId: 'energy',
        level: 500,
        capacity: 2022,
        activityBonusKcal: 0,
        satietyReserveKcal: 500,
        lastSatietySyncAt: Date.now(),
      },
      { date: todayString(), batteryTypeId: 'protein', level: 40, capacity: 120 },
      { date: todayString(), batteryTypeId: 'carbs', level: 100, capacity: 300 },
    ],
    masterPercentage: 25,
    foodLog: [],
    activityLog: [],
    intakeLog: [],
    lastDrainSyncAt: Date.now(),
    isLoaded: true,
  });
}

function pastDayRows(day: string): BatteryReading[] {
  return [
    { date: day, batteryTypeId: 'protein', level: 20, capacity: 120 },
    {
      date: day,
      batteryTypeId: 'energy',
      level: 300,
      capacity: 2000,
      satietyReserveKcal: 77,
      lastSatietySyncAt: 123456,
    },
  ];
}

describe('energyStore — logFoodForPastDate (S-S4)', () => {
  let getReadingsSpy: jest.SpyInstance;
  let upsertSpy: jest.SpyInstance;
  let addEntrySpy: jest.SpyInstance;
  let upsertDailyLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(dailyLogRepository, 'getDailyLog').mockResolvedValue(null);
    getReadingsSpy = jest.spyOn(batteryRepository, 'getReadingsForDate');
    upsertSpy = jest.spyOn(batteryRepository, 'upsertReadings').mockResolvedValue(undefined);
    addEntrySpy = jest.spyOn(foodLogRepository, 'addFoodLogEntry').mockResolvedValue(undefined);
    upsertDailyLogSpy = jest
      .spyOn(dailyLogRepository, 'upsertDailyLog')
      .mockResolvedValue(undefined);
    seedTodayReadings();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('a fully-past backfill never changes any of today\'s in-memory numbers', async () => {
    const ts = pastNoonTimestamp(3);
    const pastDay = dateString(new Date(ts));
    getReadingsSpy.mockResolvedValue(pastDayRows(pastDay));

    const before = JSON.parse(JSON.stringify(useEnergyStore.getState().readings));
    await useEnergyStore.getState().logFoodForPastDate(makeFoodItem(), 100, ts);

    const state = useEnergyStore.getState();
    expect(state.readings).toEqual(before);
    expect(state.masterPercentage).toBe(25);
    expect(state.foodLog).toEqual([]);
  });

  it('charges the PAST day\'s persisted rows and records the log entry for it', async () => {
    const ts = pastNoonTimestamp(3);
    const pastDay = dateString(new Date(ts));
    getReadingsSpy.mockResolvedValue(pastDayRows(pastDay));

    await useEnergyStore.getState().logFoodForPastDate(makeFoodItem(), 100, ts);

    const upserted: BatteryReading[] = upsertSpy.mock.calls.flat(2);
    const protein = upserted.find((r) => r.batteryTypeId === 'protein');
    const energy = upserted.find((r) => r.batteryTypeId === 'energy');
    expect(protein).toMatchObject({ date: pastDay, level: 30 }); // 20 + 10g
    expect(energy).toMatchObject({ date: pastDay, level: 500 }); // 300 + 200 kcal
    // The continuous satiety reserve must pass through byte-identical.
    expect(energy?.satietyReserveKcal).toBe(77);
    expect(energy?.lastSatietySyncAt).toBe(123456);

    expect(addEntrySpy).toHaveBeenCalledWith(
      expect.objectContaining({ energyDayApplied: pastDay, energyKcal: 200, grams: 100 })
    );
    expect(upsertDailyLogSpy).toHaveBeenCalledWith(
      expect.objectContaining({ date: pastDay })
    );
  });

  it('builds fresh readings for a day the app was never opened on', async () => {
    const ts = pastNoonTimestamp(4);
    const pastDay = dateString(new Date(ts));
    getReadingsSpy.mockResolvedValue([]); // nothing stored for that day

    await useEnergyStore.getState().logFoodForPastDate(makeFoodItem(), 100, ts);

    const upserted: BatteryReading[] = upsertSpy.mock.calls.flat(2);
    const energy = upserted.find((r) => r.batteryTypeId === 'energy');
    const protein = upserted.find((r) => r.batteryTypeId === 'protein');
    const profile = useSettingsStore.getState().userProfile;
    expect(energy).toMatchObject({
      date: pastDay,
      level: 200, // fresh ledger charged by the meal
      capacity: dailyCalorieTarget(profile).targetKcal,
    });
    expect(energy?.satietyReserveKcal).toBeUndefined(); // spec: left unset
    expect(protein).toMatchObject({ date: pastDay, level: 10 });
  });

  it('0h-6am overlap (spec 3c): kcal charges the LOADED energy reading, nutrients the historical day', async () => {
    // "Now" is 2am on the 10th → the loaded energy day is the 9th.
    jest.useFakeTimers().setSystemTime(new Date('2026-07-10T02:00:00'));
    seedTodayReadings(); // re-seed under the fake clock
    const ts = new Date('2026-07-09T23:00:00').getTime();
    getReadingsSpy.mockResolvedValue([
      { date: '2026-07-09', batteryTypeId: 'protein', level: 20, capacity: 120 },
    ]);

    await useEnergyStore.getState().logFoodForPastDate(makeFoodItem(), 100, ts);

    const state = useEnergyStore.getState();
    const loadedEnergy = state.readings.find((r) => r.batteryTypeId === 'energy');
    const loadedProtein = state.readings.find((r) => r.batteryTypeId === 'protein');
    expect(loadedEnergy?.level).toBe(700); // 500 + 200 kcal, in the store
    expect(loadedEnergy?.satietyReserveKcal).toBe(500); // no satiety top-up
    expect(loadedProtein?.level).toBe(40); // today's nutrients untouched

    // Yesterday's nutrient row got the protein instead.
    const upserted: BatteryReading[] = upsertSpy.mock.calls.flat(2);
    const historicalProtein = upserted.find(
      (r) => r.batteryTypeId === 'protein' && r.date === '2026-07-09'
    );
    expect(historicalProtein?.level).toBe(30);
  });

  it('a timestamp on the current day delegates to logFood', async () => {
    const original = useEnergyStore.getState().logFood;
    const logFoodMock = jest.fn().mockResolvedValue(undefined);
    useEnergyStore.setState({ logFood: logFoodMock });
    try {
      const item = makeFoodItem();
      const ts = Date.now();
      await useEnergyStore.getState().logFoodForPastDate(item, 150, ts);
      expect(logFoodMock).toHaveBeenCalledWith(item, 150, ts, undefined);
      expect(addEntrySpy).not.toHaveBeenCalled(); // logFood owns persistence
    } finally {
      useEnergyStore.setState({ logFood: original });
    }
  });
});

describe('energyStore — removeFoodForPastDate (S-S4)', () => {
  let getReadingsSpy: jest.SpyInstance;
  let upsertSpy: jest.SpyInstance;
  let deleteEntrySpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(dailyLogRepository, 'getDailyLog').mockResolvedValue(null);
    jest.spyOn(dailyLogRepository, 'upsertDailyLog').mockResolvedValue(undefined);
    jest.spyOn(foodLogRepository, 'addFoodLogEntry').mockResolvedValue(undefined);
    getReadingsSpy = jest.spyOn(batteryRepository, 'getReadingsForDate');
    upsertSpy = jest.spyOn(batteryRepository, 'upsertReadings').mockResolvedValue(undefined);
    deleteEntrySpy = jest
      .spyOn(foodLogRepository, 'deleteFoodLogEntry')
      .mockResolvedValue(undefined);
    seedTodayReadings();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('round-trips a fully-past backfill: the day\'s rows return to their original levels', async () => {
    const ts = pastNoonTimestamp(3);
    const pastDay = dateString(new Date(ts));
    const original = pastDayRows(pastDay);
    getReadingsSpy.mockResolvedValue(original);

    await useEnergyStore.getState().logFoodForPastDate(makeFoodItem(), 100, ts);
    const charged: BatteryReading[] = upsertSpy.mock.calls.flat(2);
    upsertSpy.mockClear();
    // The DB now holds the charged rows; the undo reads them back.
    getReadingsSpy.mockResolvedValue(charged);

    const entry: FoodLogEntry = {
      id: `food_${ts}_test_food`,
      timestamp: ts,
      mealType: 'lunch',
      foodId: 'test_food',
      foodNameVi: 'Món thử',
      grams: 100,
      energyKcal: 200,
      proteinG: 10,
      fatG: 5,
      carbG: 30,
      waterG: 0,
      mineralsMg: 0,
      energyDayApplied: pastDay,
    };
    // BUG-2 guard: the entry must still exist in the DB for the undo to run.
    jest.spyOn(foodLogRepository, 'getFoodLogForDate').mockResolvedValue([entry]);

    const storeBefore = JSON.parse(JSON.stringify(useEnergyStore.getState().readings));
    await useEnergyStore.getState().removeFoodForPastDate(entry);

    const reversed: BatteryReading[] = upsertSpy.mock.calls.flat(2);
    expect(reversed.find((r) => r.batteryTypeId === 'protein')?.level).toBe(20);
    expect(reversed.find((r) => r.batteryTypeId === 'energy')?.level).toBe(300);
    expect(reversed.find((r) => r.batteryTypeId === 'energy')?.satietyReserveKcal).toBe(77);
    expect(deleteEntrySpy).toHaveBeenCalledWith(entry.id);
    // Today stays untouched on the undo path too.
    expect(useEnergyStore.getState().readings).toEqual(storeBefore);
  });

  it('is idempotent: a second call for an already-deleted entry reverses nothing (BUG-2)', async () => {
    const ts = pastNoonTimestamp(3);
    const pastDay = dateString(new Date(ts));
    // The entry is gone from the DB (first delete already ran).
    jest.spyOn(foodLogRepository, 'getFoodLogForDate').mockResolvedValue([]);

    const entry: FoodLogEntry = {
      id: `food_${ts}_test_food`,
      timestamp: ts,
      mealType: 'lunch',
      foodId: 'test_food',
      foodNameVi: 'Món thử',
      grams: 100,
      energyKcal: 200,
      proteinG: 10,
      fatG: 5,
      carbG: 30,
      waterG: 0,
      mineralsMg: 0,
      energyDayApplied: pastDay,
    };
    await useEnergyStore.getState().removeFoodForPastDate(entry);

    expect(upsertSpy).not.toHaveBeenCalled();
    expect(deleteEntrySpy).not.toHaveBeenCalled();
  });

  it('delegates to removeFood when the entry is in today\'s loaded list', async () => {
    const entry: FoodLogEntry = {
      id: 'food_x',
      timestamp: Date.now(),
      mealType: 'lunch',
      foodId: 'test_food',
      foodNameVi: 'Món thử',
      grams: 100,
      energyKcal: 200,
      proteinG: 10,
      fatG: 5,
      carbG: 30,
      waterG: 0,
      mineralsMg: 0,
      energyDayApplied: energyDayString(),
    };
    useEnergyStore.setState({ foodLog: [entry] });
    const original = useEnergyStore.getState().removeFood;
    const removeFoodMock = jest.fn().mockResolvedValue(undefined);
    useEnergyStore.setState({ removeFood: removeFoodMock });
    try {
      await useEnergyStore.getState().removeFoodForPastDate(entry);
      expect(removeFoodMock).toHaveBeenCalledWith('food_x');
      expect(deleteEntrySpy).not.toHaveBeenCalled();
    } finally {
      useEnergyStore.setState({ removeFood: original });
    }
  });
});
