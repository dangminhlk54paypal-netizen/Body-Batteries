import { expectedShareByHour, pickHomeKeywords } from '../homeKeywords';
import type { DailyBatteryTotals } from '../dailyBatteryTotals';

const totals = (patch: Partial<DailyBatteryTotals>): DailyBatteryTotals => ({
  protein: 0,
  carbs: 0,
  minerals: 0,
  water: 0,
  sleep: 0,
  movementSteps: 0,
  movementKcal: 0,
  ...patch,
});

const targets = { protein: 120, water: 2500, sleep: 8, movement: 8000 };

describe('expectedShareByHour', () => {
  it('is 0 before the day starts, 1 at night, linear between', () => {
    expect(expectedShareByHour(5)).toBe(0);
    expect(expectedShareByHour(14)).toBe(0.5);
    expect(expectedShareByHour(23)).toBe(1);
  });
});

describe('pickHomeKeywords', () => {
  it('shows nothing paced before 06:00 (no scolding at night/early morning)', () => {
    expect(pickHomeKeywords(totals({}), targets, 5)).toEqual([]);
  });

  it('asks only for the catch-up amount, not the whole day, in the morning', () => {
    // 07:00 → 1/16 of the day expected: 2500 ml × 1/16 ≈ 156 ml → 1 glass.
    expect(pickHomeKeywords(totals({}), { water: 2500 }, 7)).toEqual([
      { battery: 'water', tone: 'mid', kind: 'short', amount: 1 },
    ]);
  });

  it('shows no chip for a battery that is on pace', () => {
    expect(pickHomeKeywords(totals({ protein: 70 }), { protein: 120 }, 14)).toEqual([]);
  });

  it('puts clearly-behind batteries first and caps at three', () => {
    const k = pickHomeKeywords(
      totals({ protein: 20, water: 1500, sleep: 8, movementSteps: 1000 }),
      targets,
      18
    );
    // 18:00 → 75 % expected.
    expect(k.map((x) => x.tone)).toEqual(['low', 'low', 'mid']);
    expect(k[0]).toEqual({ battery: 'protein', tone: 'low', kind: 'short', amount: 70 });
    expect(k[1]).toEqual({ battery: 'movement', tone: 'low', kind: 'short', amount: 5000 });
    expect(k[2]).toEqual({ battery: 'water', tone: 'mid', kind: 'short', amount: 2 });
  });

  it('asks for the whole remainder late in the evening', () => {
    const [protein] = pickHomeKeywords(totals({ protein: 90 }), { protein: 120 }, 22);
    expect(protein).toEqual({ battery: 'protein', tone: 'mid', kind: 'short', amount: 30 });
  });

  it('marks a reached target as done', () => {
    const k = pickHomeKeywords(totals({ sleep: 8.5 }), { sleep: 8 }, 9);
    expect(k).toEqual([{ battery: 'sleep', tone: 'good', kind: 'done', amount: 0 }]);
  });

  it('skips sleep until it is logged and rounds a short night to half hours', () => {
    expect(pickHomeKeywords(totals({}), { sleep: 8 }, 9)).toEqual([]);
    const [sleep] = pickHomeKeywords(totals({ sleep: 6.8 }), { sleep: 8 }, 9);
    expect(sleep).toEqual({ battery: 'sleep', tone: 'mid', kind: 'short', amount: 1 });
  });

  it('treats 0 steps as "no step data", not as idle', () => {
    expect(pickHomeKeywords(totals({}), { movement: 8000 }, 20)).toEqual([]);
  });

  it('ignores batteries without a target', () => {
    expect(pickHomeKeywords(totals({}), {}, 20)).toEqual([]);
  });
});
