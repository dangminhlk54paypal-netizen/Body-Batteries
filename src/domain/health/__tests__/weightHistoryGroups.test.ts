import {
  groupWeightHistoryByMonth,
  isTrendTowardGoal,
  weightGoalDirection,
} from '../weightHistoryGroups';

const at = (iso: string) => new Date(iso).getTime();

describe('groupWeightHistoryByMonth', () => {
  it('returns no groups for an empty log', () => {
    expect(groupWeightHistoryByMonth([])).toEqual([]);
  });

  it('groups newest month first with newest rows first, regardless of input order', () => {
    const groups = groupWeightHistoryByMonth([
      { id: 1, timestamp: at('2026-07-30T08:00:00'), value: 70 },
      { id: 3, timestamp: at('2026-08-05T08:00:00'), value: 69.4 },
      { id: 2, timestamp: at('2026-08-01T08:00:00'), value: 69.8 },
    ]);
    expect(groups.map((g) => g.monthKey)).toEqual(['2026-08', '2026-07']);
    expect(groups[0].rows.map((r) => r.entry.id)).toEqual([3, 2]);
    expect(groups[1].rows.map((r) => r.dayKey)).toEqual(['2026-07-30']);
  });

  it('compares with the latest reading at least 7 days earlier, not the previous one', () => {
    const groups = groupWeightHistoryByMonth([
      { id: 1, timestamp: at('2026-09-01T08:00:00'), value: 80 },
      { id: 2, timestamp: at('2026-09-05T08:00:00'), value: 78 },
      { id: 3, timestamp: at('2026-09-08T08:00:00'), value: 81 }, // vs 01.09 (80) → up
      { id: 4, timestamp: at('2026-09-10T08:00:00'), value: 77 }, // vs 01.09 (80) → down
      { id: 5, timestamp: at('2026-09-12T08:00:00'), value: 78 }, // vs 05.09 (78) → same
    ]);
    const trendById = Object.fromEntries(groups[0].rows.map((r) => [r.entry.id, r.trend]));
    expect(trendById).toEqual({ 1: null, 2: null, 3: 'up', 4: 'down', 5: 'same' });
  });

  it('after a gap longer than a week, compares with the last reading before the gap', () => {
    const groups = groupWeightHistoryByMonth([
      { id: 1, timestamp: at('2026-08-01T08:00:00'), value: 80 },
      { id: 2, timestamp: at('2026-08-03T08:00:00'), value: 79 },
      { id: 3, timestamp: at('2026-08-30T08:00:00'), value: 78 },
    ]);
    expect(groups[0].rows[0].trend).toBe('down'); // 78 vs 03.08's 79
  });

  it('marks a week break between a Monday and the previous Sunday, not inside a week', () => {
    const groups = groupWeightHistoryByMonth([
      { id: 1, timestamp: at('2026-09-13T08:00:00'), value: 80 }, // Sun
      { id: 2, timestamp: at('2026-09-14T08:00:00'), value: 80 }, // Mon
      { id: 3, timestamp: at('2026-09-16T08:00:00'), value: 80 }, // Wed
      { id: 4, timestamp: at('2026-09-23T08:00:00'), value: 80 }, // Wed, next week
    ]);
    const breakById = Object.fromEntries(groups[0].rows.map((r) => [r.entry.id, r.weekBreakAbove]));
    // Newest first: 23.09 | 16.09, 14.09 | 13.09
    expect(breakById).toEqual({ 4: false, 3: true, 2: false, 1: true });
  });

  it('never marks the first row of a month (the month header separates it)', () => {
    const groups = groupWeightHistoryByMonth([
      { id: 1, timestamp: at('2026-08-31T08:00:00'), value: 80 },
      { id: 2, timestamp: at('2026-09-07T08:00:00'), value: 80 },
    ]);
    expect(groups.map((g) => g.rows[0].weekBreakAbove)).toEqual([false, false]);
  });

  it('averages each month to 0.1 kg', () => {
    const groups = groupWeightHistoryByMonth([
      { id: 1, timestamp: at('2026-08-01T08:00:00'), value: 70 },
      { id: 2, timestamp: at('2026-08-02T08:00:00'), value: 70.1 },
      { id: 3, timestamp: at('2026-08-03T08:00:00'), value: 70.1 },
    ]);
    expect(groups[0].average).toBe(70.1);
  });
});

describe('weightGoalDirection', () => {
  // 168 cm → healthy 52.2–70.3 kg.
  it('is "lose" above the healthy range, "gain" below it, "maintain" inside', () => {
    expect(weightGoalDirection(78, 168)).toBe('lose');
    expect(weightGoalDirection(50, 168)).toBe('gain');
    expect(weightGoalDirection(65, 168)).toBe('maintain');
  });
});

describe('isTrendTowardGoal', () => {
  it('treats down as good when losing and up as good when gaining', () => {
    expect(isTrendTowardGoal('down', 'lose')).toBe(true);
    expect(isTrendTowardGoal('up', 'lose')).toBe(false);
    expect(isTrendTowardGoal('up', 'gain')).toBe(true);
    expect(isTrendTowardGoal('down', 'gain')).toBe(false);
  });

  it('stays neutral inside the healthy range, without change, or without a comparison', () => {
    expect(isTrendTowardGoal('down', 'maintain')).toBeNull();
    expect(isTrendTowardGoal('same', 'lose')).toBeNull();
    expect(isTrendTowardGoal(null, 'lose')).toBeNull();
  });
});
