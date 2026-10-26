import { buildActivityNames } from '../../energy/activityText/parseActivityText';
import { parseDayText, splitDayItems, type DayTextItem } from '../parseDayText';

// "Kể cả ngày": one text for the whole day → foods and workouts in the order
// said, a time word carrying over to whatever comes after it.
const names = buildActivityNames();
const summary = (items: DayTextItem[]) =>
  items.map((item) =>
    item.kind === 'food'
      ? `food:${item.food.foodQuery}@${item.food.time?.meal ?? item.food.time?.hour ?? '-'}`
      : `act:${item.activity.match?.kind === 'type' ? item.activity.match.type : item.activity.match?.kind ?? '?'}@${item.activity.time?.meal ?? item.activity.time?.hour ?? '-'}`
  );

describe('parseDayText', () => {
  it('cuts a whole day into foods and workouts, carrying the time words', () => {
    const items = parseDayText(
      'Sáng 6h chạy bộ 30 phút, ăn phở bò. Trưa 2 chén cơm với ức gà 200g. Chiều 5h tập gym: squat 5x5 100kg, kéo xô 4x12 40kg. Tối ăn bún chả rồi đi bộ 8000 bước',
      names
    );
    expect(summary(items)).toEqual([
      'act:running@breakfast',
      'food:phở bò@breakfast',
      'food:cơm@lunch',
      'food:ức gà@lunch',
      'act:lift@snack',
      'act:bodybuilding@snack',
      'food:bún chả@dinner',
      'act:walking@dinner',
    ]);
  });

  it('splits "xong" / "sau đó" / "danach" between a workout and a meal', () => {
    expect(summary(parseDayText('hôm qua tối đá bóng từ 19h đến 20h30 xong uống 1 lon bia', names))).toEqual([
      'act:football@dinner',
      'food:bia@dinner',
    ]);
    expect(summary(parseDayText('Heute früh 45 Minuten joggen, danach Müsli', names))).toEqual([
      'act:running@breakfast',
      'food:müsli@breakfast',
    ]);
  });

  it('reads English too', () => {
    expect(summary(parseDayText('This morning I ran 5k in 28 minutes, then had 2 eggs and toast', names))).toEqual([
      'act:running@breakfast',
      'food:eggs@breakfast',
      'food:toast@breakfast',
    ]);
  });

  it('keeps a pasted AI meal answer as food only', () => {
    const json = '{"items":[{"name":"Phở bò","grams":500},{"name":"Chạy bộ","grams":1}]}';
    expect(parseDayText(json, names).every((item) => item.kind === 'food')).toBe(true);
  });
});

describe('splitDayItems', () => {
  it('lets an exact food name win when only a name was said ("gà chạy bộ")', () => {
    const items = parseDayText('gà chạy bộ, chạy bộ, chạy bộ 30 phút', names);
    const isFood = (food: { foodQuery: string }) => food.foodQuery === 'gà chạy bộ';
    const { foods, activities } = splitDayItems(items, isFood);
    expect(foods.map((f) => f.foodQuery)).toEqual(['gà chạy bộ']);
    expect(activities.map((a) => a.minutes)).toEqual([null, 30]);
  });

  it('a workout word with nothing else stays a workout even if a food contains it', () => {
    const { foods, activities } = splitDayItems(parseDayText('sáng chạy', names), () => true);
    expect(foods).toEqual([]);
    expect(activities).toHaveLength(1);
  });
});
