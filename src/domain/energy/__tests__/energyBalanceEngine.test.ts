import {
  energyCapacity,
  createEnergyReading,
  reconcileEnergyCapacity,
  kcalFromMacro,
  chargeEnergy,
  burnEnergy,
  burnPassive,
  burnActivity,
} from '../energyBalanceEngine';
import type { BatteryReading } from '../../../types/battery';
import type { UserProfile } from '../../../types/energy';

const profile: UserProfile = {
  weightKg: 78,
  heightCm: 168,
  age: 30,
  sex: 'male',
  occupation: 'sedentary',
};

function energyReading(level: number, capacity = 2022): BatteryReading {
  return { date: '2026-06-18', batteryTypeId: 'energy', level, capacity };
}

describe('energyCapacity / createEnergyReading', () => {
  it('capacity = passive daily burn (2022 for the example profile)', () => {
    expect(energyCapacity(profile)).toBe(2022);
  });
  it('a fresh energy reading starts full', () => {
    expect(createEnergyReading('2026-06-18', profile)).toEqual({
      date: '2026-06-18',
      batteryTypeId: 'energy',
      level: 2022,
      capacity: 2022,
    });
  });
});

describe('kcalFromMacro (4 kcal/g)', () => {
  it('converts protein and carbs', () => {
    expect(kcalFromMacro('protein', 30)).toBe(120);
    expect(kcalFromMacro('carbs', 50)).toBe(200);
  });
  it('non-macro batteries contribute 0', () => {
    expect(kcalFromMacro('water', 500)).toBe(0);
    expect(kcalFromMacro('sleep', 8)).toBe(0);
  });
});

describe('chargeEnergy', () => {
  it('adds kcal but never overflows capacity', () => {
    expect(chargeEnergy(energyReading(1500), 300).level).toBe(1800);
    expect(chargeEnergy(energyReading(2000), 300).level).toBe(2022);
  });
  it('ignores non-positive kcal', () => {
    expect(chargeEnergy(energyReading(1500), 0).level).toBe(1500);
    expect(chargeEnergy(energyReading(1500), -50).level).toBe(1500);
  });
});

describe('burnEnergy', () => {
  it('subtracts kcal but never goes below 0', () => {
    expect(burnEnergy(energyReading(1000), 600).level).toBe(400);
    expect(burnEnergy(energyReading(300), 600).level).toBe(0);
  });
});

describe('burnPassive', () => {
  it('burns passive metabolism for elapsed hours', () => {
    // passiveBurnPerHour = 2022 / 24 = 84.25; 1h -> 2022 - 84.25 = 1937.75 -> 1937.8
    expect(burnPassive(energyReading(2022), profile, 1).level).toBe(1937.8);
  });
});

describe('burnActivity', () => {
  it('burns steps + workout kcal', () => {
    // 8000 steps (312) + 60 min football (624) = 936
    const result = burnActivity(energyReading(2022), profile, 8000, [
      { type: 'football', minutes: 60 },
    ]);
    expect(result.level).toBe(2022 - 936);
  });
});

describe('reconcileEnergyCapacity', () => {
  it('updates capacity from a new profile and clamps the level', () => {
    const lighter = reconcileEnergyCapacity(energyReading(2022, 2022), {
      ...profile,
      weightKg: 60,
    });
    // BMR(60,168,30,m)=10*60+6.25*168-150+5=1505; *1.2=1806
    expect(lighter.capacity).toBe(1806);
    expect(lighter.level).toBe(1806); // clamped down from 2022
  });
});
