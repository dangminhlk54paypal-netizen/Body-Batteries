import { checkLowBattery, hasCriticalBattery } from '../lowBatteryRules';
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

describe('checkLowBattery', () => {
  it('flags a battery below the default 20% threshold', () => {
    const readings: BatteryReading[] = [
      reading({ batteryTypeId: 'protein', level: 18, capacity: 120 }), // 15%
    ];
    const alerts = checkLowBattery(readings);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].batteryTypeId).toBe('protein');
    expect(alerts[0].percentage).toBe(15);
    expect(alerts[0].message).toContain('Protein');
    expect(alerts[0].message).toContain('15%');
  });

  it('does not flag a battery at or above the threshold', () => {
    const readings: BatteryReading[] = [
      reading({ batteryTypeId: 'carbs', level: 125, capacity: 250 }), // 50%
    ];
    expect(checkLowBattery(readings)).toHaveLength(0);
  });

  it('ignores the master battery even if it is low', () => {
    const readings: BatteryReading[] = [
      reading({ batteryTypeId: 'master', level: 1, capacity: 100 }), // 1%
    ];
    expect(checkLowBattery(readings)).toHaveLength(0);
  });

  it('respects a custom threshold', () => {
    const readings: BatteryReading[] = [
      reading({ batteryTypeId: 'water', level: 1000, capacity: 2500 }), // 40%
    ];
    expect(checkLowBattery(readings, 0.2)).toHaveLength(0);
    expect(checkLowBattery(readings, 0.5)).toHaveLength(1);
  });

  it('falls back to the raw battery id when there is no known display name', () => {
    const readings: BatteryReading[] = [
      reading({ batteryTypeId: 'unknown_id' as unknown as BatteryReading['batteryTypeId'], level: 1, capacity: 100 }),
    ];
    const alerts = checkLowBattery(readings);
    expect(alerts[0].message).toContain('unknown_id');
  });
});

describe('hasCriticalBattery', () => {
  it('returns true when a battery is below 10%', () => {
    const readings: BatteryReading[] = [reading({ level: 5, capacity: 100 })];
    expect(hasCriticalBattery(readings)).toBe(true);
  });

  it('returns false when no battery is below 10%', () => {
    const readings: BatteryReading[] = [reading({ level: 15, capacity: 100 })];
    expect(hasCriticalBattery(readings)).toBe(false);
  });

  it('ignores the master battery', () => {
    const readings: BatteryReading[] = [
      reading({ batteryTypeId: 'master', level: 0, capacity: 100 }),
    ];
    expect(hasCriticalBattery(readings)).toBe(false);
  });
});