import { blockWeekDates, matchesSearch, mergeSameWeekday, setScheduleDay } from '../blockSchedule';
import type { BlockDayPlan } from '../../../types/powerliftingBlock';

const day = (dayOfWeek: BlockDayPlan['dayOfWeek'], variationId: string, accessory?: string): BlockDayPlan => ({
  dayOfWeek,
  variations: [{ exercise: 'squat', variationId, role: 'main' }],
  accessories: accessory ? [{ customName: accessory, sets: 3, reps: '10' }] : [],
});

describe('mergeSameWeekday', () => {
  it('keeps one session per weekday, Monday first and Sunday last', () => {
    const merged = mergeSameWeekday([day(0, 'a'), day(3, 'b'), day(1, 'c'), day(3, 'd', 'Row')]);
    expect(merged.map((d) => d.dayOfWeek)).toEqual([1, 3, 0]);
    expect(merged[1].variations.map((v) => v.variationId)).toEqual(['b', 'd']);
    expect(merged[1].accessories.map((a) => a.customName)).toEqual(['Row']);
  });
});

describe('setScheduleDay', () => {
  const week = [day(1, 'a'), day(5, 'b')];

  it('adds or replaces a weekday', () => {
    expect(setScheduleDay(week, 3, day(3, 'x')).map((d) => d.dayOfWeek)).toEqual([1, 3, 5]);
    expect(setScheduleDay(week, 5, day(5, 'y'))[1].variations[0].variationId).toBe('y');
  });

  it('removes a weekday with null', () => {
    expect(setScheduleDay(week, 1, null).map((d) => d.dayOfWeek)).toEqual([5]);
  });
});

describe('matchesSearch', () => {
  it('ignores case, accents and word order', () => {
    expect(matchesSearch('co dung', ['Bench', 'Bench có dừng 1s trên ngực'])).toBe(true);
    expect(matchesSearch('PAUSED squat', ['Squat', 'Squat có dừng (Paused Squat)'])).toBe(true);
    expect(matchesSearch('deficit', ['Squat', 'Squat tiêu chuẩn'])).toBe(false);
    expect(matchesSearch('   ', ['anything'])).toBe(true);
  });
});

describe('blockWeekDates', () => {
  it('lays out back-to-back weeks, the last one the deload', () => {
    expect(blockWeekDates('2026-09-01', 2, true)).toEqual([
      { week: 1, isDeload: false, start: '2026-09-01', end: '2026-09-07' },
      { week: 2, isDeload: false, start: '2026-09-08', end: '2026-09-14' },
      { week: 3, isDeload: true, start: '2026-09-15', end: '2026-09-21' },
    ]);
    expect(blockWeekDates('2026-09-01', 1, false)).toHaveLength(1);
  });
});
