import {
  satietyPercentage,
  eatIntoReserve,
  drainFromWorkout,
  circadianBurnKcal,
  applyCircadianDrain,
} from '../satietyEngine';
import { passiveDailyBurn } from '../metabolismEngine';
import {
  FULLNESS_CAPACITY_KCAL,
  SATIETY_FLOOR_PCT,
} from '../../../lib/metabolicConstants';
import type { UserProfile } from '../../../types/energy';

const profile: UserProfile = {
  weightKg: 78,
  heightCm: 168,
  age: 30,
  sex: 'male',
  occupation: 'sedentary',
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Local time at a given hour-of-day on a fixed date, so tests are independent
// of the machine's timezone offset in absolute terms but still land on the
// intended local hour.
function localTimeAt(hour: number, minute = 0, day = 10): number {
  return new Date(2026, 6, day, hour, minute, 0, 0).getTime();
}

describe('circadianBurnKcal — 24h invariant (most important test)', () => {
  const dailyBurn = passiveDailyBurn(profile);

  it.each([0, 3, 6, 9, 12, 17, 20, 23])(
    'sums to passiveDailyBurn for a full 24h window starting at hour %i',
    (startHour) => {
      const from = localTimeAt(startHour);
      const to = from + DAY_MS;
      expect(circadianBurnKcal(profile, from, to)).toBe(dailyBurn);
    }
  );

  it('holds across multiple consecutive days (72h = 3x daily burn)', () => {
    const from = localTimeAt(6);
    const to = from + 3 * DAY_MS;
    expect(circadianBurnKcal(profile, from, to)).toBe(3 * dailyBurn);
  });
});

describe('circadianBurnKcal — awake burns faster than asleep', () => {
  it('1 awake hour burns more than 1 asleep hour', () => {
    const awakeHour = circadianBurnKcal(profile, localTimeAt(10), localTimeAt(11));
    const asleepHour = circadianBurnKcal(profile, localTimeAt(2), localTimeAt(3));
    expect(awakeHour).toBeGreaterThan(asleepHour);
  });

  it('a burn spanning the sleep→wake boundary splits at the boundary rate', () => {
    // 05:00-07:00 crosses the 06:00 wake boundary: 1h asleep + 1h awake.
    const spanning = circadianBurnKcal(profile, localTimeAt(5), localTimeAt(7));
    const asleepHour = circadianBurnKcal(profile, localTimeAt(2), localTimeAt(3));
    const awakeHour = circadianBurnKcal(profile, localTimeAt(10), localTimeAt(11));
    expect(spanning).toBe(asleepHour + awakeHour);
  });

  it('non-positive interval burns 0', () => {
    const t = localTimeAt(10);
    expect(circadianBurnKcal(profile, t, t)).toBe(0);
    expect(circadianBurnKcal(profile, t, t - HOUR_MS)).toBe(0);
  });
});

describe('eatIntoReserve', () => {
  it('adds kcal to the reserve', () => {
    expect(eatIntoReserve(200, 300)).toBe(500);
  });
  it('clamps at FULLNESS_CAPACITY_KCAL', () => {
    expect(eatIntoReserve(FULLNESS_CAPACITY_KCAL - 100, 900)).toBe(FULLNESS_CAPACITY_KCAL);
  });
  it('ignores non-positive kcal', () => {
    expect(eatIntoReserve(500, 0)).toBe(500);
    expect(eatIntoReserve(500, -50)).toBe(500);
  });
});

describe('drainFromWorkout', () => {
  it('subtracts workout kcal from the reserve', () => {
    expect(drainFromWorkout(600, 250)).toBe(350);
  });
  it('floors at 0', () => {
    expect(drainFromWorkout(100, 250)).toBe(0);
  });
  it('ignores non-positive kcal', () => {
    expect(drainFromWorkout(500, 0)).toBe(500);
    expect(drainFromWorkout(500, -50)).toBe(500);
  });
});

describe('applyCircadianDrain', () => {
  it('drains the reserve by the elapsed circadian burn', () => {
    const from = localTimeAt(10);
    const to = from + HOUR_MS;
    const burn = circadianBurnKcal(profile, from, to);
    expect(applyCircadianDrain(FULLNESS_CAPACITY_KCAL, profile, from, to)).toBe(
      FULLNESS_CAPACITY_KCAL - burn
    );
  });
  it('floors at 0 (does not go negative)', () => {
    const from = localTimeAt(6);
    const to = from + DAY_MS * 2;
    expect(applyCircadianDrain(100, profile, from, to)).toBe(0);
  });
});

describe('satietyPercentage', () => {
  it('reserve = 0 maps to the floor', () => {
    expect(satietyPercentage(0)).toBe(SATIETY_FLOOR_PCT);
  });
  it('reserve = full capacity maps to 100', () => {
    expect(satietyPercentage(FULLNESS_CAPACITY_KCAL)).toBe(100);
  });
  it('reserve = half capacity maps to the midpoint between floor and 100', () => {
    expect(satietyPercentage(FULLNESS_CAPACITY_KCAL / 2)).toBe(
      SATIETY_FLOOR_PCT + (100 - SATIETY_FLOOR_PCT) / 2
    );
  });
  it('clamps out-of-range reserves', () => {
    expect(satietyPercentage(-100)).toBe(SATIETY_FLOOR_PCT);
    expect(satietyPercentage(FULLNESS_CAPACITY_KCAL * 2)).toBe(100);
  });
});
