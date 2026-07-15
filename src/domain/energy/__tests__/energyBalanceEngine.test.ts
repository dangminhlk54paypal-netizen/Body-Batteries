import {
  energyCapacity,
  createEnergyReading,
  reconcileEnergyCapacity,
  kcalFromMacro,
  chargeEnergy,
  burnEnergy,
  growGoalFromActivity,
  burnedSoFar,
  canEatNow,
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

function energyReading(level: number, capacity = 2022, activityBonusKcal = 0): BatteryReading {
  return { date: '2026-06-18', batteryTypeId: 'energy', level, capacity, activityBonusKcal };
}

describe('energyCapacity / createEnergyReading', () => {
  it('capacity = passive daily burn (2022 for the example profile)', () => {
    expect(energyCapacity(profile)).toBe(2022);
  });
  it('a fresh energy reading starts EMPTY (S-M: eaten/goal model)', () => {
    expect(createEnergyReading('2026-06-18', profile)).toEqual({
      date: '2026-06-18',
      batteryTypeId: 'energy',
      level: 0,
      capacity: 2022,
      activityBonusKcal: 0,
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
  it('adds kcal to level, no upper clamp (overeating is allowed to show as surplus)', () => {
    expect(chargeEnergy(energyReading(1500), 300).level).toBe(1800);
    expect(chargeEnergy(energyReading(2000), 300).level).toBe(2300); // past capacity, on purpose
  });
  it('ignores non-positive kcal', () => {
    expect(chargeEnergy(energyReading(1500), 0).level).toBe(1500);
    expect(chargeEnergy(energyReading(1500), -50).level).toBe(1500);
  });
});

describe('burnEnergy (undo a logged food entry)', () => {
  it('subtracts kcal but never goes below 0', () => {
    expect(burnEnergy(energyReading(1000), 600).level).toBe(400);
    expect(burnEnergy(energyReading(300), 600).level).toBe(0);
  });
});

describe('growGoalFromActivity', () => {
  it('grows capacity (goal) by steps + workout kcal, leaves level untouched', () => {
    // 8000 steps (312) + 60 min football (624) = 936
    const result = growGoalFromActivity(energyReading(500, 2022), profile, 8000, [
      { type: 'football', minutes: 60 },
    ]);
    expect(result.level).toBe(500); // unchanged
    expect(result.capacity).toBe(2022 + 936);
    expect(result.activityBonusKcal).toBe(936);
  });
  it('accumulates activityBonusKcal across multiple calls', () => {
    const once = growGoalFromActivity(energyReading(0, 2022, 0), profile, 4000, []);
    const twice = growGoalFromActivity(once, profile, 4000, []);
    expect(twice.activityBonusKcal).toBe(once.activityBonusKcal! * 2);
    expect(twice.capacity).toBe(2022 + once.activityBonusKcal! * 2);
  });
  it('does nothing for zero activity', () => {
    const result = growGoalFromActivity(energyReading(500, 2022), profile, 0, []);
    expect(result).toEqual(energyReading(500, 2022));
  });

  // BUG B fix: growGoalFromActivity now accepts an optional stepType so the
  // movement-pin sync (energyStore.addIntake('movement', ...)) can use a
  // research-backed per-type rate instead of always assuming walking.
  it('with stepType "hiking" grows the goal MORE than "walking" for the same steps', () => {
    const walking = growGoalFromActivity(energyReading(500, 2022), profile, 5000, [], 'walking');
    const hiking = growGoalFromActivity(energyReading(500, 2022), profile, 5000, [], 'hiking');
    expect(hiking.activityBonusKcal!).toBeGreaterThan(walking.activityBonusKcal!);
  });
  it('defaults to "walking" when stepType is omitted (backward compatible)', () => {
    const withDefault = growGoalFromActivity(energyReading(500, 2022), profile, 5000, []);
    const explicitWalking = growGoalFromActivity(energyReading(500, 2022), profile, 5000, [], 'walking');
    expect(withDefault).toEqual(explicitWalking);
  });
});

describe('reconcileEnergyCapacity', () => {
  it('recomputes capacity from a new profile but keeps level (eaten) untouched', () => {
    const lighter = reconcileEnergyCapacity(energyReading(2500, 2022), {
      ...profile,
      weightKg: 60,
    });
    // BMR(60,168,30,m)=10*60+6.25*168-150+5=1505; *1.2=1806
    expect(lighter.capacity).toBe(1806);
    expect(lighter.level).toBe(2500); // NOT clamped down — eaten stays as eaten
  });
  it('preserves the activity bonus already earned today', () => {
    const withBonus = energyReading(500, 2022 + 300, 300);
    const reconciled = reconcileEnergyCapacity(withBonus, profile);
    expect(reconciled.capacity).toBe(2022 + 300);
    expect(reconciled.activityBonusKcal).toBe(300);
  });
});

describe('burnedSoFar', () => {
  it('spreads passive burn evenly since midnight, plus activity bonus', () => {
    // passiveBurnPerHour = 2022 / 24 = 84.25
    expect(burnedSoFar(profile, 1, 0)).toBeCloseTo(84.25);
    expect(burnedSoFar(profile, 10, 100)).toBeCloseTo(842.5 + 100);
  });
  it('clamps negative elapsed hours to 0', () => {
    expect(burnedSoFar(profile, -5, 50)).toBe(50);
  });
});

describe('canEatNow', () => {
  it('is positive when burned-so-far exceeds eaten (room to eat)', () => {
    // 10h elapsed -> burned 842.5; ate 500 -> can eat 342.5
    expect(canEatNow(energyReading(500), profile, 10)).toBeCloseTo(342.5);
  });
  it('is negative when eaten exceeds burned-so-far (ate ahead of pace)', () => {
    // 1h elapsed -> burned 84.25; ate 500 -> -415.75, rounded to 1 decimal -> -415.7
    expect(canEatNow(energyReading(500), profile, 1)).toBeCloseTo(-415.7, 1);
  });
});
