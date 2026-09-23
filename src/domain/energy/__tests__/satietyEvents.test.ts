import { buildSatietyEvents } from '../satietyEvents';
import type { FoodLogEntry } from '../../../types/food';
import type { ActivityLogEntry } from '../../../types/energy';
import type { IntakeEvent } from '../../../types/battery';

const food = (id: string, timestamp: number, energyKcal: number): FoodLogEntry =>
  ({ id, timestamp, energyKcal } as FoodLogEntry);
const intake = (id: string, batteryTypeId: IntakeEvent['batteryTypeId'], amount: number, note: string, timestamp = 1000): IntakeEvent =>
  ({ id, timestamp, batteryTypeId, amount, note });
const activity = (over: Partial<ActivityLogEntry>): ActivityLogEntry =>
  ({ id: 'a1', timestamp: 5000, satietyDrainKcal: 300, ...over } as ActivityLogEntry);

const none = { foodLog: [], intakeEvents: [], activityLog: [] };

describe('buildSatietyEvents', () => {
  it('a food entry becomes an eat event at its MEAL time', () => {
    expect(buildSatietyEvents({ ...none, foodLog: [food('f1', 1234, 600)] })).toEqual([
      { atMs: 1234, kind: 'eat', kcal: 600 },
    ]);
  });

  it('skips zero-kcal food', () => {
    expect(buildSatietyEvents({ ...none, foodLog: [food('f1', 1, 0)] })).toEqual([]);
  });

  it('a 50 g protein quick-tap becomes 200 kcal', () => {
    const ev = buildSatietyEvents({ ...none, intakeEvents: [intake('protein_1', 'protein', 50, 'quick')] });
    expect(ev).toEqual([{ atMs: 1000, kind: 'eat', kcal: 200 }]);
  });

  it('water / sleep quick-taps add no kcal', () => {
    const ev = buildSatietyEvents({
      ...none,
      intakeEvents: [intake('water_1', 'water', 500, ''), intake('sleep_1', 'sleep', 7, '')],
    });
    expect(ev).toEqual([]);
  });

  it('addCalories rows (id energy_*) count, even with a free-text note', () => {
    const ev = buildSatietyEvents({
      ...none,
      intakeEvents: [
        intake('energy_1', 'energy', 350, 'calories'),
        intake('energy_2', 'energy', 120, 'bánh mì'),
      ],
    });
    expect(ev.map((e) => e.kcal)).toEqual([350, 120]);
    expect(ev.every((e) => e.kind === 'eat')).toBe(true);
  });

  it('derived Excel-only rows (workout_*, movement_*) do NOT become eat events', () => {
    const ev = buildSatietyEvents({
      ...none,
      intakeEvents: [
        intake('workout_5000_0', 'energy', 624, 'workout: running 30m'),
        intake('movement_5000', 'movement', 3000, 'steps'),
      ],
    });
    expect(ev).toEqual([]);
  });

  it('a workout drains at its END time when that is earlier than the log time', () => {
    const ev = buildSatietyEvents({ ...none, activityLog: [activity({ startAt: 3000, endAt: 4000 })] });
    expect(ev).toEqual([{ atMs: 4000, kind: 'workout', kcal: 300 }]);
  });

  it('a workout falls back to the log time without endAt, or when endAt is later', () => {
    expect(buildSatietyEvents({ ...none, activityLog: [activity({})] })[0].atMs).toBe(5000);
    expect(buildSatietyEvents({ ...none, activityLog: [activity({ endAt: 9000 })] })[0].atMs).toBe(5000);
  });

  it('steps-only / backfilled activity (satietyDrainKcal 0) adds nothing', () => {
    expect(buildSatietyEvents({ ...none, activityLog: [activity({ satietyDrainKcal: 0 })] })).toEqual([]);
  });

  it('rows passed twice (DB + in-memory) are de-duplicated by id', () => {
    const f = food('f1', 10, 500);
    const a = activity({});
    const i = intake('energy_1', 'energy', 100, 'calories');
    const ev = buildSatietyEvents({ foodLog: [f, f], intakeEvents: [i, i], activityLog: [a, a] });
    expect(ev).toHaveLength(3);
  });
});
