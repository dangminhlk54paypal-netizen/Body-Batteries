import { buildWeekRings } from '../weekRingsModel';
import type { FoodLogEntry } from '../../../types/food';
import type { ActivityLogEntry } from '../../../types/energy';
import type { BatteryReading, BatteryId } from '../../../types/battery';

const at = (date: string, hour = 12) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime();

function food(date: string, kcal: number, proteinG: number): FoodLogEntry {
  return {
    id: `${date}-${kcal}`,
    timestamp: at(date),
    mealType: 'lunch',
    foodId: 'x',
    foodNameVi: 'x',
    grams: 100,
    energyKcal: kcal,
    proteinG,
    fatG: 0,
    carbG: 0,
    waterG: 0,
    mineralsMg: 0,
  };
}

function activity(date: string, steps: number): ActivityLogEntry {
  return {
    id: `a-${date}`,
    timestamp: at(date),
    steps,
    workouts: [],
    energyKcal: 0,
    satietyDrainKcal: 0,
    energyDayApplied: date,
  } as ActivityLogEntry;
}

function readingsFor(date: string, energyCapacity = 2000): BatteryReading[] {
  const caps: [BatteryId, number][] = [
    ['protein', 150],
    ['carbs', 250],
    ['water', 3000],
    ['minerals', 1000],
    ['sleep', 8],
    ['movement', 8000],
    ['energy', energyCapacity],
  ];
  return caps.map(([batteryTypeId, capacity]) => ({ date, batteryTypeId, level: 0, capacity }));
}

const DATES = ['2026-09-21', '2026-09-22', '2026-09-23'];
const TODAY = '2026-09-23';

describe('buildWeekRings', () => {
  const summary = buildWeekRings({
    dates: DATES,
    today: TODAY,
    foodLog: [food('2026-09-21', 1500, 160), food('2026-09-22', 2300, 90), food('2026-09-23', 600, 40)],
    activityLog: [activity('2026-09-21', 9000)],
    intakeLog: [],
    readings: [...readingsFor('2026-09-21'), ...readingsFor('2026-09-22'), ...readingsFor('2026-09-23')],
    appleHealthBurned: new Map([['2026-09-22', 2500]]),
  });

  it('computes each battery as intake over that day’s target', () => {
    const d = summary.days[0];
    expect(d.ratios.protein).toBeCloseTo(160 / 150);
    expect(d.ratios.movement).toBeCloseTo(9000 / 8000);
    expect(d.metCount).toBe(2);
  });

  it('balances eaten kcal against Apple Health burn, else the energy estimate', () => {
    expect(summary.days[0].balanceKcal).toBe(1500 - 2000); // energy battery capacity
    expect(summary.days[1].balanceKcal).toBe(2300 - 2500); // Apple Health
  });

  it('sums the balance over finished days only (today is still running)', () => {
    expect(summary.finishedBalanceKcal).toBe(-500 + -200);
    expect(summary.finishedDaysWithFood).toBe(2);
  });

  it('counts the days each battery hit its target', () => {
    expect(summary.hitCounts.protein).toBe(1);
    expect(summary.hitCounts.movement).toBe(1);
    expect(summary.hitCounts.water).toBe(0);
  });

  it('has no balance on a day without food and no ratio without a target', () => {
    const empty = buildWeekRings({
      dates: ['2026-09-20'],
      today: TODAY,
      foodLog: [],
      activityLog: [],
      intakeLog: [],
      readings: [],
      appleHealthBurned: new Map(),
    });
    expect(empty.days[0].balanceKcal).toBeNull();
    expect(empty.days[0].ratios.protein).toBeNull();
    expect(empty.days[0].metCount).toBe(0);
  });
});
