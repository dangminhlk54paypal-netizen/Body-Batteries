import { addDaysToDateString, mondayFirstRank } from '../../lib/dateUtils';
import type { BlockDayPlan } from '../../types/powerliftingBlock';

// The Block Builder's weekly schedule, edited one weekday per page (swipe
// Monday → Sunday). Pure helpers so the wizard only paints.

export type Weekday = BlockDayPlan['dayOfWeek'];

// Monday-first, the way lifters read a training week.
export const WEEK_ORDER: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 0];

// One session per weekday, Monday first. An older block may hold two cards on
// the same weekday (the old editor allowed it); reusing it folds them into one
// so each weekday page shows everything planned for that day.
export function mergeSameWeekday(days: BlockDayPlan[]): BlockDayPlan[] {
  const byDay = new Map<Weekday, BlockDayPlan>();
  for (const d of days) {
    const cur = byDay.get(d.dayOfWeek);
    byDay.set(
      d.dayOfWeek,
      cur
        ? { ...cur, variations: [...cur.variations, ...d.variations], accessories: [...cur.accessories, ...d.accessories] }
        : { ...d, variations: [...d.variations], accessories: [...d.accessories] }
    );
  }
  return [...byDay.values()].sort((a, b) => mondayFirstRank(a.dayOfWeek) - mondayFirstRank(b.dayOfWeek));
}

// Replaces (or with `null` removes) one weekday's session, keeping the week
// Monday-first.
export function setScheduleDay(days: BlockDayPlan[], dayOfWeek: Weekday, next: BlockDayPlan | null): BlockDayPlan[] {
  const others = days.filter((d) => d.dayOfWeek !== dayOfWeek);
  return mergeSameWeekday(next ? [...others, { ...next, dayOfWeek }] : others);
}

// Lower-case, accents and đ folded — so "co dung" finds "Có dừng".
export function foldSearchText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

// Every word of the query appears somewhere in the texts (any order).
export function matchesSearch(query: string, texts: string[]): boolean {
  const words = foldSearchText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = foldSearchText(texts.join(' '));
  return words.every((w) => hay.includes(w));
}

export interface BlockWeekDates {
  week: number; // 1-based
  isDeload: boolean;
  start: string;
  end: string;
}

// The real dates of every week of a block starting on `startMonday` — the
// same back-to-back 7-day weeks the block engine lays out.
export function blockWeekDates(startMonday: string, progressiveWeeks: number, hasDeload: boolean): BlockWeekDates[] {
  const total = progressiveWeeks + (hasDeload ? 1 : 0);
  return Array.from({ length: total }, (_, i) => {
    const start = addDaysToDateString(startMonday, i * 7);
    return { week: i + 1, isDeload: hasDeload && i === progressiveWeeks, start, end: addDaysToDateString(start, 6) };
  });
}
