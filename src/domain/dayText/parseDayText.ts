import { decodeActivityPiece, type ActivityName, type DecodedActivity } from '../energy/activityText/parseActivityText';
import { carryTimes, decodePiece, parseMealAnswer, splitPieces, type DecodedMealItem } from '../food/mealText/parseMealText';

// "Kể cả ngày" — one text for the whole day, typed or dictated in the
// evening: "sáng 6h chạy bộ 30 phút, ăn phở bò, trưa cơm gà, tối squat 5x5
// 100kg rồi đi bộ 8000 bước". Cut into pieces like the meal parser, each
// piece read as a workout (energy/activityText) or a food (food/mealText),
// and a time word carries over to the pieces after it whichever kind they
// are. Pure — which foods exist is the mapper's business (splitDayItems).

export type DayTextItem =
  | { kind: 'food'; food: DecodedMealItem }
  // `food` is the same piece read as a food, kept when only a name was said
  // beside the workout word ("gà chạy bộ") — splitDayItems decides.
  | { kind: 'activity'; activity: DecodedActivity; food: DecodedMealItem | null };

// Said between two things done one after the other, beyond the meal
// parser's "và / rồi / then / dann".
const DAY_CONNECTORS = /\s(?:xong|sau đó|sau do|after that|afterwards|danach|anschließend|anschliessend)\s/i;

type Piece =
  | { kind: 'food'; food: Omit<DecodedMealItem, 'time'> }
  | { kind: 'activity'; activity: DecodedActivity; asFood: Omit<DecodedMealItem, 'time'> | null };

export function parseDayText(text: string, names: ActivityName[]): DayTextItem[] {
  // A pasted AI meal answer (JSON or a nutrition analysis) is food only.
  const answer = parseMealAnswer(text);
  if (answer) return answer.map((food) => ({ kind: 'food', food }));

  const pieces = splitPieces(text)
    .flatMap((piece) => ` ${piece} `.split(DAY_CONNECTORS))
    .map((part) => part.trim())
    .filter(Boolean)
    .map((raw): { item: Piece | null; time: DecodedActivity['time'] } => {
      const activity = decodeActivityPiece(raw, names);
      const food = decodePiece(raw);
      if (activity) {
        const asFood = activity.keywordOnly && activity.extra && food.item ? food.item : null;
        return { item: { kind: 'activity', activity, asFood }, time: activity.time };
      }
      return { item: food.item ? { kind: 'food', food: food.item } : null, time: food.time };
    });

  return carryTimes(pieces).map(({ item, time }): DayTextItem =>
    item.kind === 'food'
      ? { kind: 'food', food: { ...item.food, time } }
      : {
          kind: 'activity',
          activity: { ...item.activity, time },
          food: item.asFood ? { ...item.asFood, time } : null,
        }
  );
}

// Foods and workouts, in the order said. A workout piece that only named
// something whose extra words make an exact food ("gà chạy bộ") is a food.
export function splitDayItems(
  items: DayTextItem[],
  isFood: (food: DecodedMealItem) => boolean
): { foods: DecodedMealItem[]; activities: DecodedActivity[] } {
  const foods: DecodedMealItem[] = [];
  const activities: DecodedActivity[] = [];
  for (const item of items) {
    if (item.kind === 'food') foods.push(item.food);
    else if (item.food && isFood(item.food)) foods.push(item.food);
    else activities.push(item.activity);
  }
  return { foods, activities };
}
