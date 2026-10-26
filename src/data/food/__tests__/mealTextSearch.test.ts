import { searchForMealText } from '../mealTextSearch';
import { getAnyFoodById } from '../foodLookup';
import { parseMealText } from '../../../domain/food/mealText/parseMealText';
import { atLocalTime, buildMealDraft } from '../../../domain/food/mealText/mapMealText';
import { DEFAULT_MEAL_WINDOWS } from '../../../lib/constants';

// "Nạp bằng chữ" end to end against the real catalog: the sentences the owner
// would actually type, and the food + grams each row must land on.
function rows(text: string, preferIds: ReadonlySet<string> = new Set()) {
  return buildMealDraft(parseMealText(text), {
    now: atLocalTime('2026-10-23', 13, 0),
    today: '2026-10-23',
    baseDate: '2026-10-23',
    maxDaysBack: 3,
    mealWindows: DEFAULT_MEAL_WINDOWS,
    recentLog: [],
    search: (q) => searchForMealText(q, preferIds),
    resolve: getAnyFoodById,
    language: 'vi',
  }).map((r) => [r.food?.id ?? null, r.grams]);
}

describe('searchForMealText — staples', () => {
  it('a bare everyday word means the plain staple, in all three languages', () => {
    for (const word of ['cơm', 'com', 'rice', 'Reis']) {
      expect(searchForMealText(word, new Set()).matches[0].id).toBe('rice_white_cooked');
    }
    expect(searchForMealText('eggs', new Set()).matches[0].id).toBe('egg_chicken');
    expect(searchForMealText('Milch', new Set()).matches[0].id).toBe('milk_whole');
  });

  it('a recently logged match keeps first place', () => {
    const plain = searchForMealText('cơm', new Set()).matches;
    const other = plain.find((f) => f.id !== 'rice_white_cooked')!;
    const preferred = searchForMealText('cơm', new Set([other.id])).matches;
    expect(preferred[0].id).toBe(other.id);
  });
});

describe('meal text → catalog rows', () => {
  it('maps a typical Vietnamese sentence', () => {
    expect(rows('2 chén cơm, phở bò và 200g ức gà lúc 12h')).toEqual([
      ['rice_white_cooked', 300],
      ['dish_pho_bo', 500],
      ['chicken_breast', 200],
    ]);
  });

  it('keeps the dish when a longer description has no exact food', () => {
    expect(rows('bánh mì trứng')[0][0]).toBe('bread_baguette');
    expect(rows('ba chỉ nướng')[0][0]).toBe('pork_belly');
  });

  it('uses the food\'s own presets', () => {
    expect(rows('1 tô bún bò huế')).toEqual([['dish_bun_bo_hue', 500]]);
    expect(rows('1 quả chuối')).toEqual([['banana', 120]]);
  });

  it('maps English and German', () => {
    expect(rows('1 bowl of rice and 2 eggs')).toEqual([
      ['rice_white_cooked', 150],
      ['egg_chicken', 100],
    ]);
    expect(rows('Reis mit Hähnchen, ein Glas Milch').map((r) => r[0])).toEqual([
      'rice_white_cooked',
      'chicken_breast',
      'milk_whole',
    ]);
  });
});
