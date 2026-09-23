import {
  capacityForMode,
  clampElapsedHoursAtMidnight,
  clampLevel,
  toPercentage,
  applyIntake,
  applyDrain,
  computeMasterLevel,
  createDailyReading,
  replayDrainingPin,
} from '../batteryEngine';
import { MODES } from '../../modes/modeDefinitions';
import type { BatteryReading } from '../../../types/battery';

function reading(overrides: Partial<BatteryReading> = {}): BatteryReading {
  return {
    date: '2026-06-18',
    batteryTypeId: 'protein',
    level: 0,
    capacity: 120,
    ...overrides,
  };
}

describe('capacityForMode', () => {
  it('applies the mode multiplier to the default capacity', () => {
    expect(capacityForMode('protein', MODES.training)).toBe(180); // 120 * 1.5
    expect(capacityForMode('water', MODES.rest)).toBe(2250); // 2500 * 0.9
  });

  it('uses a 1.0 multiplier when the mode has no override', () => {
    expect(capacityForMode('protein', MODES.maintain)).toBe(120);
  });

  it('returns 0 for a battery id with no default capacity entry', () => {
    expect(capacityForMode('master', MODES.maintain)).toBe(0);
  });
});

describe('clampLevel', () => {
  it('caps the level at capacity', () => {
    expect(clampLevel(150, 100)).toBe(100);
  });

  it('floors the level at 0', () => {
    expect(clampLevel(-10, 100)).toBe(0);
  });

  it('leaves in-range levels untouched', () => {
    expect(clampLevel(50, 100)).toBe(50);
  });
});

describe('toPercentage', () => {
  it('computes a rounded percentage', () => {
    expect(toPercentage(50, 100)).toBe(50);
    expect(toPercentage(1, 3)).toBe(33);
  });

  it('returns 0 when capacity is 0 instead of dividing by zero', () => {
    expect(toPercentage(0, 0)).toBe(0);
  });
});

describe('applyIntake', () => {
  it('adds the amount to the current level', () => {
    const result = applyIntake(reading({ level: 50, capacity: 120 }), 30);
    expect(result.level).toBe(80);
  });

  it('clamps the result at capacity (no overflow)', () => {
    const result = applyIntake(reading({ level: 110, capacity: 120 }), 50);
    expect(result.level).toBe(120);
  });

  it('does not mutate the original reading', () => {
    const original = reading({ level: 50, capacity: 120 });
    applyIntake(original, 30);
    expect(original.level).toBe(50);
  });
});

describe('applyDrain', () => {
  it('reduces the level proportionally to elapsed time and drain rate', () => {
    const result = applyDrain(reading({ level: 100, capacity: 100 }), 1, 0.05);
    expect(result.level).toBe(95);
  });

  it('rounds the resulting level to 1 decimal place', () => {
    const result = applyDrain(reading({ level: 50, capacity: 120 }), 2, 0.03);
    expect(result.level).toBe(42.8);
  });

  it('clamps the level at 0 instead of going negative', () => {
    const result = applyDrain(reading({ level: 5, capacity: 100 }), 10, 0.05);
    expect(result.level).toBe(0);
  });
});

describe('clampElapsedHoursAtMidnight', () => {
  it('returns the full elapsed hours when the interval stays within one day', () => {
    const from = new Date(2026, 5, 18, 20, 0, 0, 0).getTime(); // 20:00
    const to = new Date(2026, 5, 18, 22, 0, 0, 0).getTime(); // 22:00
    expect(clampElapsedHoursAtMidnight(from, to)).toBe(2);
  });

  it('caps a tick that spans midnight at the day boundary (regression: tickDrain past midnight)', () => {
    // A tick fired for the 23:50 -> 00:20 window (30 min elapsed) must only
    // count the 10 minutes before midnight -- the rest belongs to the new
    // day's fresh reading, not yesterday's.
    const from = new Date(2026, 5, 18, 23, 50, 0, 0).getTime();
    const to = new Date(2026, 5, 19, 0, 20, 0, 0).getTime();
    const hours = clampElapsedHoursAtMidnight(from, to);
    expect(hours).toBeCloseTo(10 / 60, 10);
  });

  it('returns 0 when the interval starts exactly at midnight (nothing left for the old day)', () => {
    const from = new Date(2026, 5, 19, 0, 0, 0, 0).getTime();
    const to = new Date(2026, 5, 19, 0, 30, 0, 0).getTime();
    expect(clampElapsedHoursAtMidnight(from, to)).toBe(0.5);
  });

  it('returns 0 for a non-positive interval', () => {
    const t = new Date(2026, 5, 18, 12, 0, 0, 0).getTime();
    expect(clampElapsedHoursAtMidnight(t, t)).toBe(0);
    expect(clampElapsedHoursAtMidnight(t, t - 1000)).toBe(0);
  });
});

describe('computeMasterLevel', () => {
  it('averages the percentage of all non-master readings', () => {
    const readings: BatteryReading[] = [
      reading({ batteryTypeId: 'protein', level: 60, capacity: 120 }), // 50%
      reading({ batteryTypeId: 'water', level: 1250, capacity: 2500 }), // 50%
    ];
    expect(computeMasterLevel(readings)).toBe(50);
  });

  it('ignores any reading whose batteryTypeId is master', () => {
    const readings: BatteryReading[] = [
      reading({ batteryTypeId: 'master', level: 999, capacity: 999 }),
      reading({ batteryTypeId: 'protein', level: 30, capacity: 120 }), // 25%
    ];
    expect(computeMasterLevel(readings)).toBe(25);
  });

  it('returns 0 when there are no readings', () => {
    expect(computeMasterLevel([])).toBe(0);
  });
});

describe('createDailyReading', () => {
  it('starts at level 0 with the mode-adjusted capacity when no carry-over is given', () => {
    const result = createDailyReading('2026-06-18', 'protein', MODES.maintain);
    expect(result).toEqual({
      date: '2026-06-18',
      batteryTypeId: 'protein',
      level: 0,
      capacity: 120,
    });
  });

  it('carries over a level within the new capacity', () => {
    const result = createDailyReading('2026-06-18', 'protein', MODES.maintain, 50);
    expect(result.level).toBe(50);
  });

  it('clamps a carry-over level that exceeds the new capacity', () => {
    const result = createDailyReading('2026-06-18', 'protein', MODES.maintain, 200);
    expect(result.level).toBe(120);
  });
});
describe('replayDrainingPin — events act at the time they HAPPENED', () => {
  const HOUR = 60 * 60 * 1000;
  const dayStart = new Date(2026, 8, 23, 0, 0, 0, 0).getTime();
  const at = (h: number, m = 0) => new Date(2026, 8, 23, h, m, 0, 0).getTime();
  const CAP = 120; // protein-like
  const RATE = 0.05; // 5% of capacity per hour

  it('no events -> 0', () => {
    expect(replayDrainingPin(CAP, RATE, dayStart, [], at(22))).toBe(0);
  });

  it('core invariant: replaying a meal equals the incremental on-time path (applyIntake + applyDrain)', () => {
    // On time: charged at 12:00 (applyIntake), then drained for the 2h until 14:00.
    const atNoon = applyIntake(reading({ level: 0, capacity: CAP }), 40);
    const onTime = applyDrain(atNoon, 2, RATE).level;
    expect(replayDrainingPin(CAP, RATE, dayStart, [{ atMs: at(12), amount: 40 }], at(14))).toBeCloseTo(onTime, 1);
  });

  it('a lunch logged at 22:30 is lower than the same lunch logged at 12:05', () => {
    const lunch = [{ atMs: at(12), amount: 60 }];
    const readAtNight = replayDrainingPin(CAP, RATE, dayStart, lunch, at(22, 30));
    const readJustAfter = replayDrainingPin(CAP, RATE, dayStart, lunch, at(12, 5));
    expect(readAtNight).toBeLessThan(readJustAfter);
    expect(readAtNight).toBe(0); // 60 g - 10.5h x 6 g/h, floored
  });

  it('drains only from the moment of the event (nothing before it)', () => {
    // Before the event the pin is 0 (floor), so it can never go negative or "bank" drain.
    expect(replayDrainingPin(CAP, RATE, dayStart, [{ atMs: at(12), amount: 30 }], at(13))).toBeCloseTo(30 - 6, 1);
  });

  it('caps at capacity, and drains afterwards', () => {
    const level = replayDrainingPin(
      CAP, RATE, dayStart,
      [{ atMs: at(12), amount: 100 }, { atMs: at(12), amount: 100 }],
      at(13)
    );
    expect(level).toBeCloseTo(CAP - 6, 1);
  });

  it('input order does not matter and the input is not mutated', () => {
    const a = { atMs: at(9), amount: 20 };
    const b = { atMs: at(11), amount: 30 };
    const events = [b, a];
    const snapshot = JSON.stringify(events);
    const forward = replayDrainingPin(CAP, RATE, dayStart, [a, b], at(12));
    expect(replayDrainingPin(CAP, RATE, dayStart, events, at(12))).toBe(forward);
    expect(JSON.stringify(events)).toBe(snapshot);
  });

  it('ignores events outside [dayStart, now]', () => {
    const base = replayDrainingPin(CAP, RATE, dayStart, [{ atMs: at(10), amount: 30 }], at(12));
    const noisy = replayDrainingPin(
      CAP, RATE, dayStart,
      [{ atMs: at(10), amount: 30 }, { atMs: at(13), amount: 50 }, { atMs: dayStart - HOUR, amount: 50 }],
      at(12)
    );
    expect(noisy).toBe(base);
  });

  it('zero capacity -> 0', () => {
    expect(replayDrainingPin(0, RATE, dayStart, [{ atMs: at(10), amount: 30 }], at(12))).toBe(0);
  });
});
