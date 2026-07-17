import { useEnergyStore } from '../energyStore';
import { useSettingsStore } from '../settingsStore';
import type { BatteryReading } from '../../types/battery';
import type { ActivityLogEntry } from '../../types/energy';
import { dateString, energyDayString } from '../../lib/dateUtils';
import { dailyCalorieTarget } from '../../domain/energy/weightGoal';
import { stepsKcal } from '../../domain/energy/metabolismEngine';
import * as batteryRepository from '../../data/repositories/batteryRepository';
import * as activityLogRepository from '../../data/repositories/activityLogRepository';
import * as dailyLogRepository from '../../data/repositories/dailyLogRepository';
import * as intakeRepository from '../../data/repositories/intakeRepository';

// Same test-environment shims as energyStore.backfill.test.ts (see the
// rationale there): keep the generated food catalogs, expo-sqlite and
// AsyncStorage out of the import chain.
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

// T2.2 invariants under test: backfilling a past activity must grow THAT
// day's own goal + movement pin (never today's live ones), must round-trip
// exactly on undo, must build fresh readings for a never-opened day, and
// must write intake_events (activity's only Excel export path).

// Noon `daysBack` days ago — keeps the entry's calendar day and energy day
// equal (the plain, non-overlap case).
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
        capacity: 2000,
        activityBonusKcal: 0,
        satietyReserveKcal: 500,
        lastSatietySyncAt: Date.now(),
      },
      { date: energyDayString(), batteryTypeId: 'movement', level: 1000, capacity: 8000 },
      { date: energyDayString(), batteryTypeId: 'protein', level: 40, capacity: 120 },
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
    { date: day, batteryTypeId: 'movement', level: 500, capacity: 8000 },
    {
      date: day,
      batteryTypeId: 'energy',
      level: 300,
      capacity: 2000,
      activityBonusKcal: 0,
      satietyReserveKcal: 77,
      lastSatietySyncAt: 123456,
    },
  ];
}

describe('energyStore — logActivityForPastDate (T2.2)', () => {
  let getReadingsSpy: jest.SpyInstance;
  let upsertSpy: jest.SpyInstance;
  let addEntrySpy: jest.SpyInstance;
  let upsertDailyLogSpy: jest.SpyInstance;
  let addIntakeEventSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(dailyLogRepository, 'getDailyLog').mockResolvedValue(null);
    getReadingsSpy = jest.spyOn(batteryRepository, 'getReadingsForDate');
    upsertSpy = jest.spyOn(batteryRepository, 'upsertReadings').mockResolvedValue(undefined);
    addEntrySpy = jest
      .spyOn(activityLogRepository, 'addActivityLogEntry')
      .mockResolvedValue(undefined);
    upsertDailyLogSpy = jest
      .spyOn(dailyLogRepository, 'upsertDailyLog')
      .mockResolvedValue(undefined);
    addIntakeEventSpy = jest.spyOn(intakeRepository, 'addIntakeEvent').mockResolvedValue(undefined);
    seedTodayReadings();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("a fully-past backfill never changes any of today's in-memory numbers (movement pin + eating goal)", async () => {
    const ts = pastNoonTimestamp(3);
    const pastDay = dateString(new Date(ts));
    getReadingsSpy.mockResolvedValue(pastDayRows(pastDay));

    const before = JSON.parse(JSON.stringify(useEnergyStore.getState().readings));
    await useEnergyStore.getState().logActivityForPastDate({ steps: 3000, workouts: [] }, ts);

    const state = useEnergyStore.getState();
    expect(state.readings).toEqual(before);
    expect(state.masterPercentage).toBe(25);
    expect(state.activityLog).toEqual([]);
  });

  it("charges the PAST day's movement battery and grows THAT day's own energy goal", async () => {
    const ts = pastNoonTimestamp(3);
    const pastDay = dateString(new Date(ts));
    getReadingsSpy.mockResolvedValue(pastDayRows(pastDay));

    await useEnergyStore.getState().logActivityForPastDate({ steps: 3000, workouts: [] }, ts);

    const upserted: BatteryReading[] = upsertSpy.mock.calls.flat(2);
    const movement = upserted.find((r) => r.batteryTypeId === 'movement');
    const energy = upserted.find((r) => r.batteryTypeId === 'energy');
    const expectedKcal = stepsKcal(3000, useSettingsStore.getState().userProfile.weightKg);
    expect(movement).toMatchObject({ date: pastDay, level: 3500 }); // 500 + 3000 steps
    expect(energy).toMatchObject({
      date: pastDay,
      capacity: 2000 + expectedKcal,
      activityBonusKcal: expectedKcal,
    });
    // The continuous satiety reserve must pass through byte-identical — a
    // backfilled workout never drains it (unlike TODAY's logActivity).
    expect(energy?.satietyReserveKcal).toBe(77);
    expect(energy?.lastSatietySyncAt).toBe(123456);

    expect(addEntrySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        energyDayApplied: pastDay,
        satietyDrainKcal: 0,
        movementStepsApplied: 3000,
      })
    );
    expect(upsertDailyLogSpy).toHaveBeenCalledWith(expect.objectContaining({ date: pastDay }));
    // Excel export's only activity path (unlike food) is intake_events.
    expect(addIntakeEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({ batteryTypeId: 'movement', amount: 3000, note: 'steps' })
    );
  });

  it('builds fresh readings for a day the app was never opened on', async () => {
    const ts = pastNoonTimestamp(4);
    const pastDay = dateString(new Date(ts));
    getReadingsSpy.mockResolvedValue([]); // nothing stored for that day

    await useEnergyStore.getState().logActivityForPastDate({ steps: 3000, workouts: [] }, ts);

    const upserted: BatteryReading[] = upsertSpy.mock.calls.flat(2);
    const energy = upserted.find((r) => r.batteryTypeId === 'energy');
    const movement = upserted.find((r) => r.batteryTypeId === 'movement');
    const profile = useSettingsStore.getState().userProfile;
    const expectedKcal = stepsKcal(3000, profile.weightKg);
    // Fresh day's baseline goal (no activity bonus yet) + this backfill's own
    // growth on top — mirrors buildReadingsForMissedDay + growGoalFromActivity.
    expect(energy).toMatchObject({
      date: pastDay,
      capacity: dailyCalorieTarget(profile).targetKcal + expectedKcal,
    });
    expect(energy?.satietyReserveKcal).toBeUndefined(); // spec: left unset
    expect(movement).toMatchObject({ date: pastDay, level: 3000 });
  });

  it('a timestamp fully on the current day delegates to logActivity', async () => {
    const original = useEnergyStore.getState().logActivity;
    const logActivityMock = jest.fn().mockResolvedValue(undefined);
    useEnergyStore.setState({ logActivity: logActivityMock });
    try {
      const ts = Date.now();
      await useEnergyStore.getState().logActivityForPastDate({ steps: 500, workouts: [] }, ts);
      expect(logActivityMock).toHaveBeenCalledWith({ steps: 500, workouts: [] }, ts);
      expect(addEntrySpy).not.toHaveBeenCalled(); // logActivity owns persistence
    } finally {
      useEnergyStore.setState({ logActivity: original });
    }
  });
});

describe('energyStore — removeActivityForPastDate (T2.2)', () => {
  let getReadingsSpy: jest.SpyInstance;
  let upsertSpy: jest.SpyInstance;
  let deleteEntrySpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(dailyLogRepository, 'getDailyLog').mockResolvedValue(null);
    jest.spyOn(dailyLogRepository, 'upsertDailyLog').mockResolvedValue(undefined);
    jest.spyOn(activityLogRepository, 'addActivityLogEntry').mockResolvedValue(undefined);
    jest.spyOn(intakeRepository, 'addIntakeEvent').mockResolvedValue(undefined);
    jest.spyOn(intakeRepository, 'deleteIntakeEventsByIds').mockResolvedValue(undefined);
    getReadingsSpy = jest.spyOn(batteryRepository, 'getReadingsForDate');
    upsertSpy = jest.spyOn(batteryRepository, 'upsertReadings').mockResolvedValue(undefined);
    deleteEntrySpy = jest
      .spyOn(activityLogRepository, 'deleteActivityLogEntry')
      .mockResolvedValue(undefined);
    seedTodayReadings();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("round-trips a fully-past backfill: the day's rows return to their original levels", async () => {
    const ts = pastNoonTimestamp(3);
    const pastDay = dateString(new Date(ts));
    const original = pastDayRows(pastDay);
    getReadingsSpy.mockResolvedValue(original);

    await useEnergyStore.getState().logActivityForPastDate({ steps: 3000, workouts: [] }, ts);
    const charged: BatteryReading[] = upsertSpy.mock.calls.flat(2);
    upsertSpy.mockClear();
    getReadingsSpy.mockResolvedValue(charged); // DB now holds the charged rows
    const chargedEnergyBonus = charged.find((r) => r.batteryTypeId === 'energy')?.activityBonusKcal ?? 0;

    const entry: ActivityLogEntry = {
      id: `activity_${ts}_test`,
      timestamp: ts,
      steps: 3000,
      workouts: [],
      energyKcal: chargedEnergyBonus,
      satietyDrainKcal: 0,
      energyDayApplied: pastDay,
      movementStepsApplied: 3000,
    };
    // Idempotence guard: the entry must still exist in the DB for the undo to run.
    jest.spyOn(activityLogRepository, 'getActivityLogForDate').mockResolvedValue([entry]);

    const storeBefore = JSON.parse(JSON.stringify(useEnergyStore.getState().readings));
    await useEnergyStore.getState().removeActivityForPastDate(entry);

    const reversed: BatteryReading[] = upsertSpy.mock.calls.flat(2);
    expect(reversed.find((r) => r.batteryTypeId === 'movement')?.level).toBe(500);
    expect(reversed.find((r) => r.batteryTypeId === 'energy')?.capacity).toBe(2000);
    expect(reversed.find((r) => r.batteryTypeId === 'energy')?.satietyReserveKcal).toBe(77);
    expect(deleteEntrySpy).toHaveBeenCalledWith(entry.id);
    // Today stays untouched on the undo path too.
    expect(useEnergyStore.getState().readings).toEqual(storeBefore);
  });

  it('is idempotent: a second call for an already-deleted entry reverses nothing', async () => {
    const ts = pastNoonTimestamp(3);
    const pastDay = dateString(new Date(ts));
    jest.spyOn(activityLogRepository, 'getActivityLogForDate').mockResolvedValue([]); // already gone

    const entry: ActivityLogEntry = {
      id: `activity_${ts}_test`,
      timestamp: ts,
      steps: 3000,
      workouts: [],
      energyKcal: 105,
      satietyDrainKcal: 0,
      energyDayApplied: pastDay,
      movementStepsApplied: 3000,
    };
    await useEnergyStore.getState().removeActivityForPastDate(entry);

    expect(upsertSpy).not.toHaveBeenCalled();
    expect(deleteEntrySpy).not.toHaveBeenCalled();
  });

  it("delegates to removeActivity when the entry is in today's loaded list", async () => {
    const entry: ActivityLogEntry = {
      id: 'activity_x',
      timestamp: Date.now(),
      steps: 3000,
      workouts: [],
      energyKcal: 105,
      satietyDrainKcal: 0,
      energyDayApplied: energyDayString(),
      movementStepsApplied: 3000,
    };
    useEnergyStore.setState({ activityLog: [entry] });
    const original = useEnergyStore.getState().removeActivity;
    const removeActivityMock = jest.fn().mockResolvedValue(undefined);
    useEnergyStore.setState({ removeActivity: removeActivityMock });
    try {
      await useEnergyStore.getState().removeActivityForPastDate(entry);
      expect(removeActivityMock).toHaveBeenCalledWith('activity_x');
      expect(deleteEntrySpy).not.toHaveBeenCalled();
    } finally {
      useEnergyStore.setState({ removeActivity: original });
    }
  });
});
