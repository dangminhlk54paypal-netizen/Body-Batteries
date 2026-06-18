import {
  capacityForMode,
  clampLevel,
  toPercentage,
  applyIntake,
  applyDrain,
  computeMasterLevel,
  createDailyReading,
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