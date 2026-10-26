import type { FoodItem, FoodLogEntry } from '../../../../types/food';
import { DEFAULT_MEAL_WINDOWS } from '../../../../lib/constants';
import { parseMealText } from '../parseMealText';
import {
  AI_DRAFT_PREFIX,
  aiSavePlan,
  atLocalTime,
  buildMealDraft,
  draftTotals,
  isBlocked,
  manualRow,
  stepAmount,
  toggleRow,
  withAmount,
  withFood,
  withAiChoice,
  withAiName,
  withSavedFood,
  withTimestamp,
  type MealTextContext,
} from '../mapMealText';

const PER100 = {
  energyKcal: 100,
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
};

function food(id: string, names: string, extra: Partial<FoodItem> = {}): FoodItem {
  return {
    id,
    nameVi: names,
    nameEn: id,
    category: 'dish',
    defaultServingG: 100,
    servingPresets: [],
    per100g: PER100,
    source: 'test',
    note: '',
    ...extra,
  };
}

const RICE = food('rice', 'cơm trắng', {
  defaultServingG: 150,
  servingPresets: [
    { label: 'chén', grams: 150 },
    { label: 'bát', grams: 250 },
  ],
});
const PHO = food('pho', 'phở bò', { defaultServingG: 500 });
const EGG = food('egg', 'trứng gà luộc', { defaultServingG: 50 });
const YOGURT = food('yogurt', 'sữa chua', {
  portionUnit: 'serving',
  servingLabel: 'hộp',
  servingWeightG: 100,
});
const PORK = food('pork_belly', 'ba chỉ nướng', { defaultServingG: 120 });
const CATALOG = [RICE, PHO, EGG, YOGURT, PORK];

// Tiny stand-in for searchFoods: every query word must be in a name (the
// Vietnamese name or the English one — here the id).
function search(query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const names = (f: FoodItem) => `${f.nameVi} ${f.nameEn}`;
  const matches = CATALOG.filter((f) => words.length > 0 && words.every((w) => names(f).includes(w)));
  const similar =
    matches.length > 0 ? [] : CATALOG.filter((f) => words.some((w) => names(f).includes(w)));
  return { matches, similar };
}

const TODAY = '2026-10-23';
const NOW = atLocalTime(TODAY, 13, 0);

function ctx(over: Partial<MealTextContext> = {}): MealTextContext {
  return {
    now: NOW,
    today: TODAY,
    baseDate: TODAY,
    maxDaysBack: 3,
    mealWindows: DEFAULT_MEAL_WINDOWS,
    recentLog: [],
    search,
    resolve: (id) => CATALOG.find((f) => f.id === id),
    ...over,
  };
}

function logged(foodId: string, grams: number, timestamp: number, count?: number): FoodLogEntry {
  return {
    id: `${foodId}-${timestamp}`,
    timestamp,
    mealType: 'lunch',
    foodId,
    foodNameVi: foodId,
    grams,
    energyKcal: grams,
    proteinG: 0,
    fatG: 0,
    carbG: 0,
    waterG: 0,
    mineralsMg: 0,
    ...(count != null ? { portionUnit: 'serving' as const, count } : {}),
  };
}

function draft(text: string, c: MealTextContext = ctx()) {
  return buildMealDraft(parseMealText(text), c);
}

describe('mapping — food and amount', () => {
  it('uses the food\'s own preset for "2 chén" and "1 bát"', () => {
    const [chen, bat] = draft('2 chén cơm, 1 bát cơm');
    expect(chen).toMatchObject({ food: RICE, grams: 300, amountSource: 'preset', issues: [] });
    expect(bat.grams).toBe(250);
  });

  it('finds a preset of the same kind for another container word', () => {
    // "tô" has no preset on rice — the first bowl-type preset (chén) is used.
    expect(draft('1 tô cơm')[0]).toMatchObject({ grams: 150, amountSource: 'preset' });
  });

  it('takes grams as said', () => {
    expect(draft('200g cơm')[0]).toMatchObject({ grams: 200, amountSource: 'explicit', issues: [] });
  });

  it('counts portions of a counted food', () => {
    expect(draft('2 hộp sữa chua')[0]).toMatchObject({ count: 2, grams: 200, amountSource: 'count' });
  });

  it('multiplies the default serving for a bare count, flags an unknown unit', () => {
    expect(draft('2 trứng')[0]).toMatchObject({ grams: 100, amountSource: 'perServing', issues: [] });
    expect(draft('1 ly trứng')[0]).toMatchObject({ amountSource: 'unitGuess', issues: ['unitGuess'] });
  });

  it('uses the last logged portion when no amount is said', () => {
    const c = ctx({ recentLog: [logged('pho', 450, atLocalTime('2026-10-20', 8, 0))] });
    expect(draft('phở bò', c)[0]).toMatchObject({ grams: 450, amountSource: 'usual', issues: ['usualAmount'] });
  });

  it('falls back to the default serving for a food never logged', () => {
    expect(draft('phở bò')[0]).toMatchObject({ grams: 500, issues: ['defaultAmount'] });
  });

  it('reads the number word as part of the name when only that finds a food', () => {
    expect(draft('ba chỉ nướng')[0]).toMatchObject({ food: PORK, grams: 120, match: 'exact' });
  });

  it('marks a near match and an unknown food', () => {
    const [near, none] = draft('trứng chiên, bánh xèo');
    expect(near).toMatchObject({ food: EGG, match: 'fuzzy', selected: true });
    expect(near.issues).toContain('fuzzyMatch');
    expect(none).toMatchObject({ food: null, match: 'none', selected: false, issues: ['noMatch'] });
    expect(isBlocked(none)).toBe(true);
  });

  it('flags an unusually large amount', () => {
    expect(draft('3kg cơm')[0].issues).toContain('largeAmount');
  });
});

describe('mapping — time', () => {
  it('logs "now" when nothing is said', () => {
    expect(draft('cơm')[0].timestamp).toBe(NOW);
  });

  it('uses the middle of the meal window for a meal word', () => {
    expect(draft('sáng nay 2 trứng')[0].timestamp).toBe(atLocalTime(TODAY, 7, 30));
  });

  it('puts "hôm qua" on yesterday and a past base date at noon', () => {
    expect(draft('hôm qua phở bò')[0].timestamp).toBe(atLocalTime('2026-10-22', 12, 0));
    expect(draft('cơm', ctx({ baseDate: '2026-10-21' }))[0].timestamp).toBe(
      atLocalTime('2026-10-21', 12, 0)
    );
  });

  it('blocks a time later today and a day out of the backfill window', () => {
    const [later] = draft('tối nay phở bò');
    expect(later.issues).toContain('futureTime');
    expect(later.selected).toBe(false);
    const old = buildMealDraft(parseMealText('cơm'), ctx({ baseDate: '2026-10-15' }))[0];
    expect(old.issues).toContain('tooOld');
  });
});

describe('validation — duplicates', () => {
  const morningPho = logged('pho', 450, atLocalTime(TODAY, 11, 0));

  it('starts a duplicate unticked and attaches the earlier entry', () => {
    const [row] = draft('phở bò', ctx({ recentLog: [morningPho] }));
    expect(row.issues).toContain('duplicate');
    expect(row.duplicate).toBe(morningPho);
    expect(row.selected).toBe(false);
    // Not blocked: the user may still log a second bowl.
    expect(toggleRow(row).selected).toBe(true);
  });

  it('is not a duplicate outside the 3-hour window', () => {
    const [row] = draft('sáng nay phở bò', ctx({ recentLog: [logged('pho', 450, atLocalTime('2026-10-22', 7, 30))] }));
    expect(row.duplicate).toBeNull();
    expect(row.selected).toBe(true);
  });
});

describe('edits', () => {
  it('changing the food re-derives the amount and unblocks the row', () => {
    const [none] = draft('2 chén bánh xèo');
    const fixed = withFood(none, RICE, ctx());
    expect(fixed).toMatchObject({ food: RICE, grams: 300, match: 'manual', selected: true, issues: [] });
  });

  it('an edit never re-ticks a row the user unticked', () => {
    const [row] = draft('200g cơm');
    const unticked = toggleRow(row);
    expect(withAmount(unticked, 250, ctx()).selected).toBe(false);
  });

  it('moving a row out of the future unblocks it', () => {
    const [later] = draft('tối nay cơm');
    const moved = withTimestamp(later, atLocalTime(TODAY, 12, 0), ctx());
    expect(moved.issues).not.toContain('futureTime');
    expect(moved.selected).toBe(true);
  });

  it('steps grams by size band and counts by halves below one', () => {
    const [rice] = draft('100g cơm');
    expect(stepAmount(rice, 1, ctx()).grams).toBe(125);
    expect(stepAmount(rice, -1, ctx()).grams).toBe(90);
    const [yogurt] = draft('1 hộp sữa chua');
    expect(stepAmount(yogurt, -1, ctx())).toMatchObject({ count: 0.5, grams: 50 });
    expect(stepAmount(yogurt, 1, ctx())).toMatchObject({ count: 1.5, grams: 150 });
  });

  it('a hand-added row gets the usual portion at the given time', () => {
    const row = manualRow('m1', RICE, atLocalTime(TODAY, 12, 0), ctx());
    expect(row).toMatchObject({ grams: 150, issues: ['defaultAmount'], selected: true });
  });
});

describe('totals', () => {
  it('counts only ticked, unblocked rows', () => {
    const rows = draft('200g cơm, 2 trứng, bánh xèo');
    expect(draftTotals(rows)).toEqual({ count: 2, kcal: 300 });
    expect(draftTotals([toggleRow(rows[0]), rows[1], rows[2]])).toEqual({ count: 1, kcal: 100 });
  });
});

describe('mapping — JSON from an AI', () => {
  it('falls back to the English name when the main name finds nothing', () => {
    // The fake catalog's English names are the ids ("rice", "egg"…).
    const [row] = buildMealDraft(parseMealText('[{"name":"Gạo nấu","name_en":"rice","grams":180}]'), ctx());
    expect(row).toMatchObject({ food: RICE, match: 'exact', grams: 180, amountSource: 'explicit' });
  });
});

describe('mapping — nutrition from an AI', () => {
  const PHO_AI = '{"items":[{"name":"phở bò","grams":500,"per_100g":{"kcal":130,"protein_g":8,"carbs_g":15,"fat_g":4}}]}';

  it('keeps the app\'s food for an exact match and notes that the AI differs', () => {
    const [row] = draft(PHO_AI);
    expect(row).toMatchObject({ food: PHO, grams: 500, selected: true, issues: ['aiCompare'] });
    expect(row.ai).toMatchObject({ choice: 'app', base: PHO, stated: { energyKcal: 130, fatG: 4 } });
  });

  it('"Dùng số AI" logs the app\'s food with only the stated numbers replaced', () => {
    const row = withAiChoice(draft(PHO_AI)[0], 'ai', ctx());
    expect(row.food).toMatchObject({ id: 'pho', per100g: { ...PER100, energyKcal: 130, proteinG: 8, carbG: 15, fatG: 4 } });
    expect(row.grams).toBe(500);
    expect(row.issues).toEqual(['aiCompare']);
  });

  it('turns an unknown dish into a new food with the AI numbers, grams as the serving', () => {
    const [row] = draft(
      '{"items":[{"name":"Bún đậu mắm tôm","name_en":"Tofu vermicelli","grams":350,"per_100g":{"kcal":160,"protein_g":8,"carbs_g":18,"fat_g":6}}]}'
    );
    expect(row.issues).toEqual(['aiNew']);
    expect(row.selected).toBe(true);
    expect(row.food).toMatchObject({
      id: `${AI_DRAFT_PREFIX}t0`,
      nameVi: 'Bún đậu mắm tôm',
      nameEn: 'Tofu vermicelli',
      defaultServingG: 350,
      source: 'custom',
      per100g: { energyKcal: 160, proteinG: 8, sodiumMg: 0 },
    });
    expect(row.grams).toBe(350);
  });

  it('a near match becomes a new food, the near match kept to switch back to', () => {
    const [row] = draft('{"items":[{"name":"phở bò tái lăn","grams":450,"per_100g":{"kcal":140,"protein_g":9,"carbs_g":14,"fat_g":5}}]}');
    expect(row.ai).toMatchObject({ choice: 'new', base: PHO });
    expect(row.issues).not.toContain('fuzzyMatch');
    const back = withAiChoice(row, 'app', ctx());
    expect(back).toMatchObject({ food: PHO, grams: 450, issues: ['fuzzyMatch', 'aiCompare'] });
  });

  it('reads a plain-text analysis as one food, numbers scaled from the portion', () => {
    const [row] = draft('Bánh mì trứng\nKhẩu phần: 200 g\nCalories: 500 kcal\nProtein: 20 g\nCarbs: 60 g\nFat: 20 g');
    expect(row.food).toMatchObject({ nameVi: 'Bánh mì trứng', per100g: { energyKcal: 250, proteinG: 10, carbG: 30, fatG: 10 } });
    expect(row.grams).toBe(200);
  });

  it('flags numbers that do not add up, and a missing basis', () => {
    const [off] = draft('{"items":[{"name":"món lạ","grams":100,"per_100g":{"kcal":500,"protein_g":5,"carbs_g":5,"fat_g":5}}]}');
    expect(off.issues).toContain('aiCheck');
    const [guessed] = draft('Món lạ\nCalories: 300 kcal\nProtein: 20 g');
    expect(guessed.issues).toEqual(['aiBasis', 'defaultAmount', 'aiNew']);
    expect(guessed.grams).toBe(100);
  });

  it('renames a new food, and picking an app food compares with it instead', () => {
    const [row] = draft('{"items":[{"name":"món lạ","grams":100,"per_100g":{"kcal":100,"protein_g":5,"carbs_g":10,"fat_g":4}}]}');
    expect(withAiName(row, '  Chè bưởi ', ctx()).food?.nameVi).toBe('Chè bưởi');
    const picked = withFood(row, RICE, ctx());
    expect(picked.ai).toMatchObject({ choice: 'app', base: RICE });
    expect(picked.food).toBe(RICE);
  });

  it('plans one new food per name and one update per app food; app rows write nothing', () => {
    const rows = draft(
      '{"items":[' +
        '{"name":"chè bưởi","grams":200,"per_100g":{"kcal":120,"carbs_g":25,"protein_g":1,"fat_g":2}},' +
        '{"name":"Chè Bưởi","grams":100,"per_100g":{"kcal":120,"carbs_g":25,"protein_g":1,"fat_g":2}},' +
        '{"name":"phở bò","grams":500,"per_100g":{"kcal":130,"protein_g":8,"carbs_g":15,"fat_g":4}},' +
        '{"name":"cơm trắng","grams":150,"per_100g":{"kcal":130,"protein_g":3,"carbs_g":28,"fat_g":0.3}}]}'
    );
    rows[2] = withAiChoice(rows[2], 'ai', ctx());
    let n = 0;
    const plan = aiSavePlan(rows, () => `custom_${++n}`);
    expect(plan).toEqual([
      expect.objectContaining({ kind: 'add', food: expect.objectContaining({ id: 'custom_1', nameVi: 'chè bưởi' }), rowIds: ['t0', 't1'] }),
      expect.objectContaining({ kind: 'update', food: expect.objectContaining({ id: 'pho' }), rowIds: ['t2'] }),
    ]);
    const saved = withSavedFood(rows[0], plan[0].food, ctx());
    expect(saved).toMatchObject({ ai: null, food: { id: 'custom_1' }, grams: 200, issues: [] });
  });
});
