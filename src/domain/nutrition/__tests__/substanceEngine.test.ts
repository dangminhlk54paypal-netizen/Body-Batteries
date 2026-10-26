import {
  caffeinePerformanceRangeMg,
  evaluateSubstanceDay,
  evaluateSubstanceDays,
  isLateForSleep,
  substancesOfEntry,
  summarizeSubstanceHabits,
  type SubstanceEntry,
} from '../substanceEngine';
import { getFoodById } from '../../../data/food/foodDatabase';
import type { FoodItem, Nutrition } from '../../../types/food';

function nutrition(overrides: Partial<Nutrition> = {}): Nutrition {
  return {
    energyKcal: 0,
    waterG: 0,
    proteinG: 0,
    fatG: 0,
    carbG: 0,
    fiberG: 0,
    sugarG: 0,
    calciumMg: 0,
    ironMg: 0,
    sodiumMg: 0,
    potassiumMg: 0,
    magnesiumMg: 0,
    zincMg: 0,
    ...overrides,
  };
}

function food(id: string, per100g: Nutrition): FoodItem {
  return {
    id,
    nameVi: id,
    nameEn: id,
    category: 'drink',
    defaultServingG: 100,
    servingPresets: [],
    per100g,
    source: 'test',
    note: '',
  };
}

const FOODS: Record<string, FoodItem> = {
  monster: food('monster', nutrition({ caffeineMg: 32, taurineMg: 400, carnitineMg: 27 })),
  coffee: food('coffee', nutrition({ caffeineMg: 40 })),
  creatine: food('creatine', nutrition({ creatineMg: 100000 })),
  carnitine: food('carnitine', nutrition({ carnitineMg: 100000 })),
  rice: food('rice', nutrition({ energyKcal: 130 })),
};
const lookup = (id: string) => FOODS[id];

// Local-time timestamp on 2026-10-26 (the engine reads local hours).
function at(hour: number, minute = 0, day = 26): number {
  return new Date(2026, 9, day, hour, minute).getTime();
}

let seq = 0;
function entry(foodId: string, grams: number, timestamp: number): SubstanceEntry {
  seq += 1;
  return { id: `e${seq}`, foodId, foodNameVi: foodId, grams, timestamp };
}

describe('substancesOfEntry', () => {
  it('scales per-100 g amounts by the logged grams', () => {
    expect(substancesOfEntry(entry('monster', 355, at(9)), lookup)).toEqual({
      caffeine: 113.6,
      taurine: 1420,
      carnitine: 95.9,
      creatine: 0,
    });
  });

  it('gives zeros for a food without substances or one the catalog lost', () => {
    expect(substancesOfEntry(entry('rice', 150, at(12)), lookup).caffeine).toBe(0);
    expect(substancesOfEntry(entry('gone', 150, at(12)), lookup).caffeine).toBe(0);
  });
});

describe('isLateForSleep', () => {
  it('flags the 6 h before a 23:00 bedtime and the night after it', () => {
    expect(isLateForSleep(at(16, 59), 23)).toBe(false);
    expect(isLateForSleep(at(17, 0), 23)).toBe(true);
    expect(isLateForSleep(at(22), 23)).toBe(true);
    expect(isLateForSleep(at(1), 23)).toBe(true);
    expect(isLateForSleep(at(6), 23)).toBe(false);
  });

  it('wraps around midnight for a 1 am bedtime', () => {
    expect(isLateForSleep(at(18, 59), 1)).toBe(false);
    expect(isLateForSleep(at(19), 1)).toBe(true);
    expect(isLateForSleep(at(0, 30), 1)).toBe(true);
  });
});

describe('evaluateSubstanceDay', () => {
  it('stays quiet for a normal day', () => {
    const day = evaluateSubstanceDay(
      '2026-10-26',
      [entry('coffee', 240, at(7)), entry('monster', 355, at(13))],
      lookup,
      23
    );
    expect(day.totals.caffeine).toBe(209.6);
    expect(day.flags).toEqual([]);
    expect(day.caffeineIntakes.map((i) => i.mg)).toEqual([96, 113.6]);
  });

  it('flags the daily 400 mg mark', () => {
    const entries = [7, 9, 11, 13, 15].map((h) => entry('coffee', 240, at(h)));
    const day = evaluateSubstanceDay('2026-10-26', entries, lookup, 23);
    expect(day.totals.caffeine).toBe(480);
    expect(day.flags.map((f) => f.id)).toEqual(['caffeineDaily']);
  });

  it('treats two cans within an hour as one dose over 200 mg', () => {
    const day = evaluateSubstanceDay(
      '2026-10-26',
      [entry('monster', 355, at(9)), entry('monster', 355, at(9, 45))],
      lookup,
      23
    );
    expect(day.peakDoseMg).toBe(227.2);
    expect(day.flags.map((f) => f.id)).toContain('caffeineDose');
  });

  it('does not join two cans three hours apart into one dose', () => {
    const day = evaluateSubstanceDay(
      '2026-10-26',
      [entry('monster', 355, at(9)), entry('monster', 355, at(12))],
      lookup,
      23
    );
    expect(day.peakDoseMg).toBe(113.6);
    expect(day.flags).toEqual([]);
  });

  it('flags ≥ 100 mg inside the sleep gap', () => {
    const day = evaluateSubstanceDay('2026-10-26', [entry('monster', 355, at(19))], lookup, 23);
    expect(day.lateCaffeineMg).toBe(113.6);
    expect(day.flags.map((f) => f.id)).toEqual(['caffeineLate']);
  });

  it('flags L-carnitine over 2000 mg and creatine over the 20 g loading dose', () => {
    const day = evaluateSubstanceDay(
      '2026-10-26',
      [entry('carnitine', 2.5, at(8)), entry('creatine', 25, at(8))],
      lookup,
      23
    );
    expect(day.flags.map((f) => f.id)).toEqual(['carnitineDaily', 'creatineHigh']);
  });

  it('flags taurine only past the 3 g EFSA assessed', () => {
    const two = [9, 14].map((h) => entry('monster', 355, at(h)));
    expect(evaluateSubstanceDay('d', two, lookup, 23).flags.map((f) => f.id)).not.toContain('taurineDaily');
    const three = [8, 11, 14].map((h) => entry('monster', 355, at(h)));
    expect(evaluateSubstanceDay('d', three, lookup, 23).flags.map((f) => f.id)).toContain('taurineDaily');
  });
});

describe('evaluateSubstanceDays + summarizeSubstanceHabits', () => {
  const dates = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'];

  it('keeps an empty column for a day without entries', () => {
    const days = evaluateSubstanceDays(dates, [entry('coffee', 240, at(8, 0, 26))], lookup, 23);
    expect(days).toHaveLength(7);
    expect(days[0].totals.caffeine).toBe(0);
    expect(days[6].totals.caffeine).toBe(96);
  });

  it('notes a habit once 3 of the days repeat the same flag', () => {
    const heavy = (day: number) => [8, 11, 14, 19].map((h) => entry('monster', 355, at(h, 0, day)));
    const days = evaluateSubstanceDays(dates, [...heavy(22), ...heavy(24), ...heavy(26)], lookup, 23);
    const habits = summarizeSubstanceHabits(days);
    expect(habits.caffeineDays).toBe(3);
    expect(habits.daysOverDaily).toBe(3);
    expect(habits.lateDays).toBe(3);
    expect(habits.averageCaffeineMg).toBe(454);
    expect(habits.habits).toEqual(['caffeineDailyHabit', 'caffeineLateHabit']);
  });

  it('has no habit for two heavy days', () => {
    const heavy = (day: number) => [8, 11, 14, 17].map((h) => entry('monster', 355, at(h, 0, day)));
    const days = evaluateSubstanceDays(dates, [...heavy(22), ...heavy(24)], lookup, 23);
    expect(summarizeSubstanceHabits(days).habits).toEqual([]);
  });
});

describe('caffeinePerformanceRangeMg', () => {
  it('turns 3–6 mg/kg into mg for the body weight', () => {
    expect(caffeinePerformanceRangeMg(78, { min: 3, max: 6 })).toEqual({ min: 234, max: 468 });
  });
});

describe('catalog rows', () => {
  it('carries the label figures for Monster and the G7 estimate', () => {
    expect(getFoodById('monster_energy')?.per100g.caffeineMg).toBe(32);
    expect(getFoodById('monster_ultra')?.per100g.taurineMg).toBe(400);
    expect(getFoodById('g7_3in1')?.per100g.caffeineMg).toBe(408);
    expect(getFoodById('creatine_monohydrate')?.per100g.creatineMg).toBe(100000);
    // Undeclared stays undefined, not 0.
    expect(getFoodById('rice_white_cooked')?.per100g.caffeineMg).toBeUndefined();
  });
});
