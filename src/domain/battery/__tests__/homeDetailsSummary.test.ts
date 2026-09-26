import { summarizeHomeDetails } from '../homeDetailsSummary';
import type { FoodLogEntry } from '../../../types/food';
import type { ActivityLogEntry } from '../../../types/energy';
import type { IntakeEvent } from '../../../types/battery';
import type { MicroBatteryState } from '../../../types/nutrition';

function food(overrides: Partial<FoodLogEntry> = {}): FoodLogEntry {
  return {
    id: 'f1',
    timestamp: 0,
    mealType: 'lunch',
    foodId: 'rice',
    foodNameVi: 'Cơm',
    grams: 100,
    energyKcal: 130,
    proteinG: 3,
    fatG: 0,
    carbG: 28,
    waterG: 60,
    mineralsMg: 10,
    ...overrides,
  };
}

function activity(energyKcal: number): ActivityLogEntry {
  return {
    id: `a${energyKcal}`,
    timestamp: 0,
    steps: 0,
    workouts: [],
    energyKcal,
    satietyDrainKcal: 0,
    energyDayApplied: '2026-09-26',
  };
}

function micro(overrides: Partial<MicroBatteryState> = {}): MicroBatteryState {
  return {
    id: 'sodium',
    kind: 'limit',
    nameVi: 'Natri',
    unit: 'mg',
    color: '#fff',
    current: 1000,
    target: 2000,
    percentage: 50,
    over: false,
    ...overrides,
  };
}

const intake: IntakeEvent = { id: 'i1', timestamp: 0, batteryTypeId: 'water', amount: 250, note: '' };

describe('summarizeHomeDetails', () => {
  it('totals meals, activity and the rounded kcal balance', () => {
    const s = summarizeHomeDetails({
      foodLog: [food({ energyKcal: 500.4 }), food({ id: 'f2', energyKcal: 300.4 })],
      activityLog: [activity(200.2), activity(100.2)],
      intakeLog: [intake, { ...intake, id: 'i2' }],
      microStates: [],
      burnedKcal: 1000,
      isSupplement: () => false,
    });
    expect(s.mealsKcal).toBe(801);
    expect(s.mealCount).toBe(2);
    expect(s.activityKcal).toBe(300);
    expect(s.activityCount).toBe(2);
    expect(s.balanceKcal).toBe(-199);
    expect(s.intakeCount).toBe(2);
  });

  it('counts supplement doses, not rows', () => {
    const s = summarizeHomeDetails({
      foodLog: [food({ foodId: 'fish_oil', count: 2 }), food({ id: 'f2', foodId: 'whey' }), food({ id: 'f3' })],
      activityLog: [],
      intakeLog: [],
      microStates: [],
      burnedKcal: 0,
      isSupplement: (id) => id === 'fish_oil' || id === 'whey',
    });
    expect(s.supplementDoses).toBe(3);
  });

  it('flags only micros past their reference ceiling', () => {
    const s = summarizeHomeDetails({
      foodLog: [],
      activityLog: [],
      intakeLog: [],
      microStates: [micro(), micro({ id: 'sugar', over: true })],
      burnedKcal: 0,
      isSupplement: () => false,
    });
    expect(s.microCount).toBe(2);
    expect(s.microWarnCount).toBe(1);
  });
});
