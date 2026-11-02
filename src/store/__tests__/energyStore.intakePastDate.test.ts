import { useEnergyStore } from '../energyStore';
import { energyDayString, todayString, dateString } from '../../lib/dateUtils';
import * as batteryRepository from '../../data/repositories/batteryRepository';
import * as intakeRepository from '../../data/repositories/intakeRepository';
import * as dailyLogRepository from '../../data/repositories/dailyLogRepository';
import type { BatteryReading, IntakeEvent } from '../../types/battery';

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

function pastNoon(daysBack: number): number {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

function seedToday() {
  useEnergyStore.setState({
    readings: [
      { date: energyDayString(), batteryTypeId: 'energy', level: 500, capacity: 2000, activityBonusKcal: 0 },
      { date: todayString(), batteryTypeId: 'water', level: 300, capacity: 3000 },
      { date: todayString(), batteryTypeId: 'sleep', level: 7, capacity: 8 },
      { date: todayString(), batteryTypeId: 'protein', level: 40, capacity: 120 },
    ],
    masterPercentage: 25,
    foodLog: [],
    activityLog: [],
    intakeLog: [],
    lastDrainSyncAt: Date.now(),
    isLoaded: true,
  });
}

function spies(rows: BatteryReading[], logged: IntakeEvent[] = []) {
  jest.spyOn(batteryRepository, 'getReadingsForDate').mockResolvedValue(rows);
  jest.spyOn(intakeRepository, 'getIntakeEventsForDate').mockResolvedValue(logged);
  jest.spyOn(dailyLogRepository, 'getDailyLog').mockResolvedValue(null);
  return {
    upsert: jest.spyOn(batteryRepository, 'upsertReadings').mockResolvedValue(),
    addEvent: jest.spyOn(intakeRepository, 'addIntakeEvent').mockResolvedValue(),
    removeEvents: jest.spyOn(intakeRepository, 'deleteIntakeEventsByIds').mockResolvedValue(),
    dailyLog: jest.spyOn(dailyLogRepository, 'upsertDailyLog').mockResolvedValue(),
  };
}

const levelOf = (rows: BatteryReading[], id: string) => rows.find((r) => r.batteryTypeId === id)?.level;

beforeEach(() => {
  jest.restoreAllMocks();
  seedToday();
});

describe('addIntakeForPastDate', () => {
  it('charges that day’s row and leaves today alone', async () => {
    const ts = pastNoon(2);
    const day = dateString(new Date(ts));
    const { upsert, addEvent } = spies([{ date: day, batteryTypeId: 'water', level: 1000, capacity: 3000 }]);
    const before = useEnergyStore.getState().readings;

    await useEnergyStore.getState().addIntakeForPastDate('water', 500, ts);

    expect(useEnergyStore.getState().readings).toEqual(before);
    expect(levelOf(upsert.mock.calls[0][0], 'water')).toBe(1500);
    expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({ id: `water_${ts}`, timestamp: ts, amount: 500 }));
  });

  it('builds the row of a day the app was never opened on', async () => {
    const ts = pastNoon(2);
    const { upsert, dailyLog } = spies([]);
    await useEnergyStore.getState().addIntakeForPastDate('sleep', 7.5, ts);
    expect(levelOf(upsert.mock.calls[0][0], 'sleep')).toBe(7.5);
    expect(dailyLog).toHaveBeenCalledWith(expect.objectContaining({ date: dateString(new Date(ts)) }));
  });

  it('also charges the kcal of a macro onto that day’s energy row', async () => {
    const ts = pastNoon(2);
    const day = dateString(new Date(ts));
    const { upsert } = spies([
      { date: day, batteryTypeId: 'protein', level: 20, capacity: 120 },
      { date: day, batteryTypeId: 'energy', level: 300, capacity: 2000 },
    ]);
    await useEnergyStore.getState().addIntakeForPastDate('protein', 10, ts);
    expect(levelOf(upsert.mock.calls[0][0], 'protein')).toBe(30);
    expect(levelOf(upsert.mock.calls[0][0], 'energy')).toBe(340);
  });

  it('goes the normal way for a time on the current day, keeping that time', async () => {
    spies([]);
    const ts = Date.now() - 1000;
    await useEnergyStore.getState().addIntakeForPastDate('sleep', 1, ts);
    const state = useEnergyStore.getState();
    expect(levelOf(state.readings, 'sleep')).toBe(8);
    expect(state.intakeLog[0]).toMatchObject({ id: `sleep_${ts}`, timestamp: ts });
  });
});

describe('removeIntakeForPastDate', () => {
  const ts = pastNoon(2);
  const day = dateString(new Date(ts));
  const event: IntakeEvent = { id: `protein_${ts}`, timestamp: ts, batteryTypeId: 'protein', amount: 10, note: '' };

  it('is the exact mirror of adding', async () => {
    const { upsert, removeEvents } = spies(
      [
        { date: day, batteryTypeId: 'protein', level: 30, capacity: 120 },
        { date: day, batteryTypeId: 'energy', level: 340, capacity: 2000 },
      ],
      [event]
    );
    await useEnergyStore.getState().removeIntakeForPastDate(event);
    expect(levelOf(upsert.mock.calls[0][0], 'protein')).toBe(20);
    expect(levelOf(upsert.mock.calls[0][0], 'energy')).toBe(300);
    expect(removeEvents).toHaveBeenCalledWith([event.id]);
  });

  it('does nothing on a second tap, when the row is already gone', async () => {
    const { upsert, removeEvents } = spies([{ date: day, batteryTypeId: 'protein', level: 30, capacity: 120 }], []);
    await useEnergyStore.getState().removeIntakeForPastDate(event);
    expect(upsert).not.toHaveBeenCalled();
    expect(removeEvents).not.toHaveBeenCalled();
  });

  it('hands an entry of today’s list to removeIntake', async () => {
    spies([]);
    const today: IntakeEvent = { id: 'sleep_1', timestamp: Date.now(), batteryTypeId: 'sleep', amount: 2, note: '' };
    useEnergyStore.setState({ intakeLog: [today] });
    await useEnergyStore.getState().removeIntakeForPastDate(today);
    const state = useEnergyStore.getState();
    expect(state.intakeLog).toEqual([]);
    expect(levelOf(state.readings, 'sleep')).toBe(5);
  });
});

describe('updateIntakeForPastDate', () => {
  it('replaces the amount and keeps the event’s day and note', async () => {
    const ts = pastNoon(1);
    const day = dateString(new Date(ts));
    const event: IntakeEvent = { id: `water_${ts}`, timestamp: ts, batteryTypeId: 'water', amount: 500, note: 'gym' };
    const { addEvent, removeEvents } = spies([{ date: day, batteryTypeId: 'water', level: 1000, capacity: 3000 }], [event]);
    await useEnergyStore.getState().updateIntakeForPastDate(event, 800);
    expect(removeEvents).toHaveBeenCalledWith([event.id]);
    expect(addEvent).toHaveBeenCalledWith({ ...event, amount: 800 });
  });
});
