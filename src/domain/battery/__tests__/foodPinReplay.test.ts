import { foodPinEvents, recomputeFoodPinLevels, isFoodPin } from '../foodPinReplay';
import type { BatteryReading, IntakeEvent } from '../../../types/battery';
import type { FoodLogEntry } from '../../../types/food';

const at = (h: number, m = 0, day = 23) => new Date(2026, 8, day, h, m, 0, 0).getTime();
const food = (id: string, timestamp: number, over: Partial<FoodLogEntry> = {}): FoodLogEntry =>
  ({
    id, timestamp, mealType: 'lunch', foodId: 'f', foodNameVi: 'x', grams: 100, energyKcal: 0,
    proteinG: 0, fatG: 0, carbG: 0, waterG: 0, mineralsMg: 0, ...over,
  } as FoodLogEntry);
const tap = (id: string, batteryTypeId: IntakeEvent['batteryTypeId'], amount: number, timestamp: number): IntakeEvent =>
  ({ id, batteryTypeId, amount, timestamp, note: '' });
const pin = (batteryTypeId: BatteryReading['batteryTypeId'], capacity: number, date = '2026-09-23'): BatteryReading =>
  ({ date, batteryTypeId, level: 999, capacity });

describe('foodPinEvents', () => {
  it('maps each food field to its own pin at the MEAL time', () => {
    const log = [food('a', at(12), { proteinG: 30, carbG: 50, waterG: 200, mineralsMg: 400 })];
    expect(foodPinEvents('protein', log, [])).toEqual([{ atMs: at(12), amount: 30 }]);
    expect(foodPinEvents('carbs', log, [])).toEqual([{ atMs: at(12), amount: 50 }]);
    expect(foodPinEvents('water', log, [])).toEqual([{ atMs: at(12), amount: 200 }]);
    expect(foodPinEvents('minerals', log, [])).toEqual([{ atMs: at(12), amount: 400 }]);
  });

  it('adds only the matching battery\'s manual quick-taps', () => {
    const taps = [tap('t1', 'water', 300, at(9)), tap('t2', 'sleep', 7, at(9))];
    expect(foodPinEvents('water', [], taps)).toEqual([{ atMs: at(9), amount: 300 }]);
    expect(foodPinEvents('protein', [], taps)).toEqual([]);
  });

  it('skips zero contributions', () => {
    expect(foodPinEvents('protein', [food('a', at(12))], [])).toEqual([]);
  });
});

describe('recomputeFoodPinLevels', () => {
  const RATE = 0.05;

  it('replaces the four food pins and leaves every other battery untouched', () => {
    const readings = [pin('protein', 120), pin('movement', 8000), pin('sleep', 8), pin('energy', 2000)];
    const out = recomputeFoodPinLevels(readings, {
      foodLog: [food('a', at(12), { proteinG: 30 })],
      intakeLog: [],
      drainRatePerHour: RATE,
      nowMs: at(13),
    });
    expect(out[0].level).toBeCloseTo(30 - 120 * RATE, 1);
    expect(out.slice(1)).toEqual(readings.slice(1)); // movement/sleep/energy identical (level 999 kept)
  });

  it('a lunch logged at 22:30 reads lower than the same lunch read at 12:05', () => {
    const readings = [pin('protein', 120)];
    const input = { foodLog: [food('a', at(12), { proteinG: 60 })], intakeLog: [], drainRatePerHour: RATE };
    const late = recomputeFoodPinLevels(readings, { ...input, nowMs: at(22, 30) })[0].level;
    const early = recomputeFoodPinLevels(readings, { ...input, nowMs: at(12, 5) })[0].level;
    expect(late).toBeLessThan(early);
  });

  it('with no logs every food pin is 0 (start of day), not the stale stored level', () => {
    const out = recomputeFoodPinLevels([pin('water', 2000)], {
      foodLog: [], intakeLog: [], drainRatePerHour: RATE, nowMs: at(15),
    });
    expect(out[0].level).toBe(0);
  });

  it('a row that still carries yesterday\'s date is replayed over YESTERDAY only', () => {
    // Now is 00:20 on the 24th but the row hasn't rolled over yet (date = the 23rd).
    const yesterdayRow = pin('protein', 120, '2026-09-23');
    const out = recomputeFoodPinLevels([yesterdayRow], {
      foodLog: [
        food('dinner', at(21), { proteinG: 50 }),
        food('after-midnight', at(0, 10, 24), { proteinG: 40 }), // belongs to the 24th
      ],
      intakeLog: [],
      drainRatePerHour: RATE,
      nowMs: at(0, 20, 24),
    });
    // 50 g eaten at 21:00, drained to the END of the 23rd (3h x 6 g/h), midnight event excluded.
    expect(out[0].level).toBeCloseTo(50 - 3 * 120 * RATE, 1);
  });
});

describe('isFoodPin', () => {
  it('is true for exactly protein/carbs/water/minerals', () => {
    for (const id of ['protein', 'carbs', 'water', 'minerals'] as const) expect(isFoodPin(id)).toBe(true);
    for (const id of ['movement', 'sleep', 'energy', 'master'] as const) expect(isFoodPin(id)).toBe(false);
  });
});
