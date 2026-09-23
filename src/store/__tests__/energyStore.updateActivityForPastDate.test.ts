import { useEnergyStore } from '../energyStore';
import type { BatteryReading } from '../../types/battery';
import type { ActivityLogEntry, WorkoutSession } from '../../types/energy';
import { dateString } from '../../lib/dateUtils';
import * as batteryRepository from '../../data/repositories/batteryRepository';
import * as activityLogRepository from '../../data/repositories/activityLogRepository';
import * as dailyLogRepository from '../../data/repositories/dailyLogRepository';
import * as intakeRepository from '../../data/repositories/intakeRepository';

// Same environment shims as energyStore.activityBackfill.test.ts.
jest.mock('../../data/food/foodLookup', () => ({ getAnyFoodById: jest.fn() }));
jest.mock('../../data/db/database', () => ({
  getDb: () => ({
    runAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn().mockResolvedValue([]),
    execAsync: jest.fn().mockResolvedValue(undefined),
  }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// updateActivityForPastDate only COMPOSES existing actions (today's entry →
// updateActivity; older → removeActivityForPastDate + logActivityForPastDate
// under the original timestamp). These tests pin the property the training
// log relies on: editing an old entry leaves that day's batteries exactly as
// if the edited workout had been logged in the first place.

function pastNoon(daysBack: number): number {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

const lift = (weightKg: number, reps: number, sets: number): WorkoutSession => ({
  type: 'squat',
  minutes: 20,
  sets: Array.from({ length: sets }, () => ({ kind: 'working' as const, weightKg, reps })),
});

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

// A tiny in-memory database behind the repository functions the past-date
// actions call, so log → edit → read-back really round-trips.
let readingsDb: Map<string, BatteryReading>;
let activityDb: ActivityLogEntry[];

function seedDay(day: string) {
  readingsDb = new Map(pastDayRows(day).map((r) => [`${r.date}|${r.batteryTypeId}`, r]));
  activityDb = [];
}
const snapshotRows = (day: string) =>
  JSON.parse(
    JSON.stringify(
      [...readingsDb.values()].filter((r) => r.date === day).sort((a, b) => a.batteryTypeId.localeCompare(b.batteryTypeId))
    )
  );

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(dailyLogRepository, 'getDailyLog').mockResolvedValue(null);
  jest.spyOn(dailyLogRepository, 'upsertDailyLog').mockResolvedValue(undefined);
  jest.spyOn(intakeRepository, 'addIntakeEvent').mockResolvedValue(undefined);
  jest.spyOn(intakeRepository, 'deleteIntakeEventsByIds').mockResolvedValue(undefined);
  jest.spyOn(batteryRepository, 'getReadingsForDate').mockImplementation(async (date: string) =>
    [...readingsDb.values()].filter((r) => r.date === date)
  );
  jest.spyOn(batteryRepository, 'upsertReadings').mockImplementation(async (rows: BatteryReading[]) => {
    rows.forEach((r) => readingsDb.set(`${r.date}|${r.batteryTypeId}`, r));
  });
  jest.spyOn(activityLogRepository, 'addActivityLogEntry').mockImplementation(async (e) => {
    activityDb.push(e);
  });
  jest.spyOn(activityLogRepository, 'getActivityLogForDate').mockImplementation(async () => [...activityDb]);
  jest.spyOn(activityLogRepository, 'deleteActivityLogEntry').mockImplementation(async (id) => {
    activityDb = activityDb.filter((e) => e.id !== id);
  });
  useEnergyStore.setState({ readings: [], activityLog: [], intakeLog: [], foodLog: [] });
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('energyStore.updateActivityForPastDate — an entry from an older day', () => {
  it('leaves the day exactly as if the edited workout had been logged in the first place', async () => {
    const ts = pastNoon(3);
    const day = dateString(new Date(ts));

    // Path 1: log workout A, then edit it into workout B.
    seedDay(day);
    await useEnergyStore.getState().logActivityForPastDate({ steps: 0, workouts: [lift(100, 5, 3)] }, ts);
    const original = activityDb[0];
    await useEnergyStore.getState().updateActivityForPastDate(original, { workouts: [lift(110, 5, 5)] });
    const editedRows = snapshotRows(day);
    const editedEntries = [...activityDb];

    // Path 2: a clean day where B was logged straight away.
    seedDay(day);
    await useEnergyStore.getState().logActivityForPastDate({ steps: 0, workouts: [lift(110, 5, 5)] }, ts);
    const freshRows = snapshotRows(day);

    expect(editedRows).toEqual(freshRows);
    // The energy goal really grew (a sanity check that this isn't comparing two no-ops).
    const energy = editedRows.find((r: BatteryReading) => r.batteryTypeId === 'energy');
    expect(energy.capacity).toBeGreaterThan(2000);
    expect(editedEntries).toHaveLength(1);
    expect(editedEntries[0].workouts).toEqual([lift(110, 5, 5)]);
  });

  it('keeps the entry on its own day: same timestamp, and the id is replaced', async () => {
    const ts = pastNoon(2);
    seedDay(dateString(new Date(ts)));
    await useEnergyStore.getState().logActivityForPastDate({ steps: 0, workouts: [lift(100, 5, 3)] }, ts);
    const original = activityDb[0];

    await useEnergyStore.getState().updateActivityForPastDate(original, { workouts: [lift(105, 5, 3)] });

    expect(activityDb).toHaveLength(1);
    expect(activityDb[0].timestamp).toBe(original.timestamp);
    expect(activityDb[0].id).not.toBe(original.id);
  });

  it('editing back to the original workout restores the original day numbers', async () => {
    const ts = pastNoon(3);
    const day = dateString(new Date(ts));
    seedDay(day);
    await useEnergyStore.getState().logActivityForPastDate({ steps: 0, workouts: [lift(100, 5, 3)] }, ts);
    const afterFirstLog = snapshotRows(day);

    await useEnergyStore.getState().updateActivityForPastDate(activityDb[0], { workouts: [lift(140, 3, 8)] });
    await useEnergyStore.getState().updateActivityForPastDate(activityDb[0], { workouts: [lift(100, 5, 3)] });

    expect(snapshotRows(day)).toEqual(afterFirstLog);
  });

  it('a patch without workouts keeps the entry’s own; startAt null clears it, undefined keeps it', async () => {
    const ts = pastNoon(3);
    seedDay(dateString(new Date(ts)));
    await useEnergyStore
      .getState()
      .logActivityForPastDate({ steps: 0, workouts: [lift(100, 5, 3)], startAt: ts, endAt: ts + 3_600_000 }, ts);

    await useEnergyStore.getState().updateActivityForPastDate(activityDb[0], { endAt: null });
    expect(activityDb[0].workouts).toEqual([lift(100, 5, 3)]);
    expect(activityDb[0].startAt).toBe(ts);
    expect(activityDb[0].endAt).toBeUndefined();
  });
});

describe('energyStore.updateActivityForPastDate — an entry in today’s loaded list', () => {
  it('delegates to updateActivity and never touches the past-date actions', async () => {
    const entry: ActivityLogEntry = {
      id: 'today_1',
      timestamp: Date.now(),
      steps: 0,
      workouts: [lift(100, 5, 3)],
      energyKcal: 100,
      satietyDrainKcal: 0,
      energyDayApplied: dateString(new Date()),
    };
    const updateActivity = jest.fn().mockResolvedValue(undefined);
    const removePast = jest.fn().mockResolvedValue(undefined);
    const logPast = jest.fn().mockResolvedValue(undefined);
    const original = useEnergyStore.getState();
    useEnergyStore.setState({
      activityLog: [entry],
      updateActivity,
      removeActivityForPastDate: removePast,
      logActivityForPastDate: logPast,
    });
    try {
      const patch = { workouts: [lift(105, 5, 3)] };
      await useEnergyStore.getState().updateActivityForPastDate(entry, patch);
      expect(updateActivity).toHaveBeenCalledWith('today_1', patch);
      expect(removePast).not.toHaveBeenCalled();
      expect(logPast).not.toHaveBeenCalled();
    } finally {
      useEnergyStore.setState({
        updateActivity: original.updateActivity,
        removeActivityForPastDate: original.removeActivityForPastDate,
        logActivityForPastDate: original.logActivityForPastDate,
      });
    }
  });
});
