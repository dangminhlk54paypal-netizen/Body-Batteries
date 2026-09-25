import { buildTrainingLogIndex, suggestEntryDate } from '../trainingLogIndex';
import type { TrainingLogIndexInput } from '../trainingLogIndex';
import { addDaysToDateString } from '../../../lib/dateUtils';
import type { GeneratedBlockPlan } from '../../../types/powerliftingBlock';

// Minimal block: `weekCount` Monday→Sunday weeks from `startMonday`; the last
// one is a deload when `deload` is set. Only the fields the index reads.
function block(
  id: string,
  createdAt: number,
  startMonday: string,
  weekCount: number,
  opts: { deload?: boolean; name?: string } = {}
): GeneratedBlockPlan {
  const weeks = Array.from({ length: weekCount }, (_, i) => ({
    weekNumber: i + 1,
    isDeload: !!opts.deload && i === weekCount - 1,
    startDate: addDaysToDateString(startMonday, i * 7),
    endDate: addDaysToDateString(startMonday, i * 7 + 6),
    days: [],
    totalKcal: 0,
    weeklyDeficitTargetKcal: null,
  }));
  return { config: { id, createdAt, focus: 'volume', name: opts.name }, weeks } as unknown as GeneratedBlockPlan;
}

const input = (patch: Partial<TrainingLogIndexInput>): TrainingLogIndexInput => ({
  trainingDays: [],
  logDates: [],
  weekNoteStarts: [],
  blocks: [],
  today: '2026-09-30',
  ...patch,
});

const day = (date: string, sessions = 1) => ({ date, sessions });

// 2026-07-27 is a Monday. Block A: 5 weeks 07-27 → 08-30 (W5 ends Sun 08-30).
const blockA = block('a', 100, '2026-07-27', 5);

const weeksOf = (periods: ReturnType<typeof buildTrainingLogIndex>) => periods.flatMap((p) => p.weeks);

describe('buildTrainingLogIndex — months, with block weeks inside them', () => {
  it('a day inside a block sits in its month, in the block week that holds it', () => {
    const [p] = buildTrainingLogIndex(input({ blocks: [blockA], trainingDays: [day('2026-08-05', 2)], today: '2026-08-05' }));
    expect(p.monthKey).toBe('2026-08');
    const w2 = p.weeks.find((w) => w.weekNumber === 2);
    expect(w2?.block).toEqual({ id: 'a', number: 1, name: undefined });
    expect(w2?.dates).toEqual(['2026-08-05']);
    expect(w2?.sessions).toBe(2);
    expect(p.sessions).toBe(2);
  });

  it('a block spanning two months splits by where each week starts; each month lists its block weeks', () => {
    const periods = buildTrainingLogIndex(input({ blocks: [blockA], today: '2026-09-30' }));
    expect(periods.map((p) => p.monthKey)).toEqual(['2026-08', '2026-07']);
    expect(periods[1].weeks.map((w) => w.weekNumber)).toEqual([1]);
    expect(periods[0].weeks.map((w) => w.weekNumber)).toEqual([2, 3, 4, 5]);
    expect(periods[0].blocks).toEqual([{ id: 'a', number: 1, name: undefined, firstWeek: 2, lastWeek: 5, lastIsDeload: false }]);
  });

  it('a day outside every block is a plain week of its month', () => {
    const [p] = buildTrainingLogIndex(input({ blocks: [blockA], trainingDays: [day('2026-09-16')] }));
    expect(p).toMatchObject({ key: 'month:2026-09', monthKey: '2026-09', startDate: '2026-09-14', endDate: '2026-09-20' });
    expect(p.weeks[0].block).toBeUndefined();
    expect(p.blocks).toEqual([]);
  });

  it('groups a week by the month of its MONDAY (a week never splits)', () => {
    // Mon 2026-08-31 … Sun 2026-09-06: Tue Sep 1 belongs to August.
    const periods = buildTrainingLogIndex(input({ trainingDays: [day('2026-08-31'), day('2026-09-01')] }));
    expect(periods).toHaveLength(1);
    expect(periods[0].monthKey).toBe('2026-08');
    expect(periods[0].weeks[0].dates).toEqual(['2026-08-31', '2026-09-01']);
  });

  it('the user’s own block number wins; otherwise creation order (renumbering after a delete)', () => {
    const b1 = block('b1', 100, '2026-07-27', 1);
    const b2 = block('b2', 200, '2026-09-07', 1);
    const numbers = (blocks: GeneratedBlockPlan[]) =>
      weeksOf(buildTrainingLogIndex(input({ blocks })))
        .map((w) => [w.block?.id, w.block?.number])
        .sort();
    expect(numbers([b2, b1])).toEqual([
      ['b1', 1],
      ['b2', 2],
    ]);
    expect(numbers([b2])).toEqual([['b2', 1]]);
    const own = { ...b2, config: { ...b2.config, blockNumber: 3 } } as GeneratedBlockPlan;
    expect(numbers([own])).toEqual([['b2', 3]]);
  });

  it('carries the user-chosen block name (trimmed)', () => {
    const named = block('n', 100, '2026-07-27', 1, { name: '  Accumulation ' });
    const [p] = buildTrainingLogIndex(input({ blocks: [named] }));
    expect(p.weeks[0].block?.name).toBe('Accumulation');
    expect(p.blocks[0].name).toBe('Accumulation');
  });

  it('when blocks overlap the newest one owns the day', () => {
    const older = block('old', 100, '2026-09-07', 3);
    const newer = block('new', 200, '2026-09-14', 3);
    const weeks = weeksOf(buildTrainingLogIndex(input({ blocks: [older, newer], trainingDays: [day('2026-09-16')] })));
    expect(weeks.find((w) => w.dates.includes('2026-09-16'))?.block?.id).toBe('new');
  });

  it('a deleted block no longer labels anything: its days stay in their month', () => {
    const periods = buildTrainingLogIndex(input({ blocks: [], trainingDays: [day('2026-08-05')] }));
    expect(periods).toHaveLength(1);
    expect(periods[0].monthKey).toBe('2026-08');
    expect(periods[0].weeks[0].block).toBeUndefined();
  });

  it('counts a log-only day (hand-written / note) as one entry and shows it', () => {
    const periods = buildTrainingLogIndex(input({ blocks: [blockA], logDates: ['2026-08-12'] }));
    expect(weeksOf(periods).find((w) => w.weekNumber === 3)?.dates).toEqual(['2026-08-12']);
    expect(periods.find((p) => p.monthKey === '2026-08')?.sessions).toBe(1);
  });

  it('does not double count a day that is both trained and in the log', () => {
    const periods = buildTrainingLogIndex(
      input({ blocks: [blockA], trainingDays: [day('2026-08-12', 2)], logDates: ['2026-08-12'] })
    );
    expect(periods.find((p) => p.monthKey === '2026-08')?.sessions).toBe(2);
  });
});

describe('buildTrainingLogIndex — which block weeks show', () => {
  it('keeps every week up to today, empty ones included, and hides future weeks', () => {
    // Block A runs to 08-30; today mid-W3 → W1..W3 show, W4/W5 hidden.
    const periods = buildTrainingLogIndex(input({ blocks: [blockA], today: '2026-08-12', trainingDays: [day('2026-07-28')] }));
    expect(weeksOf(periods).map((w) => w.weekNumber).sort()).toEqual([1, 2, 3]);
    expect(weeksOf(periods).find((w) => w.weekNumber === 2)?.dates).toEqual([]); // empty but present
  });

  it('a future week appears once it has content', () => {
    const periods = buildTrainingLogIndex(input({ blocks: [blockA], today: '2026-08-05', trainingDays: [day('2026-08-20')] }));
    expect(weeksOf(periods).map((w) => w.weekNumber).sort()).toEqual([1, 2, 4]);
  });

  it('a week note keeps an otherwise future/empty week visible', () => {
    const periods = buildTrainingLogIndex(input({ blocks: [blockA], today: '2026-08-05', weekNoteStarts: ['2026-08-24'] }));
    expect(weeksOf(periods).map((w) => w.weekNumber)).toContain(5);
  });

  it('a block that is entirely in the future and empty produces nothing', () => {
    const future = block('f', 300, '2026-10-05', 3);
    expect(buildTrainingLogIndex(input({ blocks: [future], today: '2026-09-30' }))).toEqual([]);
  });

  it('marks the deload week, and the month says the block ends in a deload', () => {
    const b = block('d', 100, '2026-08-03', 4, { deload: true });
    const [p] = buildTrainingLogIndex(input({ blocks: [b], today: '2026-09-30' }));
    expect(p.weeks.map((w) => w.isDeload)).toEqual([false, false, false, true]);
    expect(p.blocks[0]).toMatchObject({ firstWeek: 1, lastWeek: 4, lastIsDeload: true });
  });

  it('hides an empty week of an older block that a newer block already covers', () => {
    const older = block('old', 100, '2026-09-07', 3); // 09-07 … 09-27
    const newer = block('new', 200, '2026-09-21', 3); // starts inside older's last week
    const weeks = weeksOf(buildTrainingLogIndex(input({ blocks: [older, newer], today: '2026-09-30' })));
    expect(weeks.filter((w) => w.block?.id === 'old').map((w) => w.weekNumber)).toEqual([1, 2]);
  });
});

describe('buildTrainingLogIndex — ordering', () => {
  it('orders months newest first and weeks/days ascending, block and plain weeks mixed', () => {
    const b2 = block('b2', 200, '2026-09-07', 2);
    const periods = buildTrainingLogIndex(
      input({
        blocks: [b2],
        today: '2026-09-30',
        trainingDays: [day('2026-09-02'), day('2026-09-09'), day('2026-09-08'), day('2026-06-03')],
      })
    );
    // Wed 02.09 is in the week of Mon 31.08 → August.
    expect(periods.map((p) => p.key)).toEqual(['month:2026-09', 'month:2026-08', 'month:2026-06']);
    expect(periods[0].weeks.map((w) => [w.weekStart, w.block?.id])).toEqual([
      ['2026-09-07', 'b2'],
      ['2026-09-14', 'b2'],
    ]);
    expect(periods[0].weeks.flatMap((w) => w.dates)).toEqual(['2026-09-08', '2026-09-09']);
    expect(periods[1].weeks.map((w) => [w.weekStart, w.block])).toEqual([['2026-08-31', undefined]]);
  });

  it('plain weeks ascend inside a month', () => {
    const [p] = buildTrainingLogIndex(input({ trainingDays: [day('2026-06-17'), day('2026-06-03')] }));
    expect(p.weeks.map((w) => w.weekStart)).toEqual(['2026-06-01', '2026-06-15']);
  });

  it('a note on a Monday outside any block creates an empty week', () => {
    const [p] = buildTrainingLogIndex(input({ weekNoteStarts: ['2026-06-08'] }));
    expect(p.weeks[0]).toMatchObject({ weekStart: '2026-06-08', weekEnd: '2026-06-14', dates: [], sessions: 0 });
  });

  it('returns nothing for a fresh install', () => {
    expect(buildTrainingLogIndex(input({}))).toEqual([]);
  });
});

describe('suggestEntryDate', () => {
  const week = (dates: string[]) => ({
    weekStart: '2026-08-24',
    weekEnd: '2026-08-30',
    sessions: dates.length,
    dates,
  });

  it('suggests the first empty day, Monday first', () => {
    expect(suggestEntryDate(week(['2026-08-24', '2026-08-26']), '2026-08-30')).toBe('2026-08-25');
    expect(suggestEntryDate(week([]), '2026-08-30')).toBe('2026-08-24');
  });

  it('never suggests a future day', () => {
    // Today is Wed; Mon+Tue+Wed are filled → falls back to the latest allowed day.
    expect(suggestEntryDate(week(['2026-08-24', '2026-08-25', '2026-08-26']), '2026-08-26')).toBe('2026-08-26');
  });

  it('a fully filled past week falls back to its last day', () => {
    const all = Array.from({ length: 7 }, (_, i) => addDaysToDateString('2026-08-24', i));
    expect(suggestEntryDate(week(all), '2026-09-15')).toBe('2026-08-30');
  });

  it('a week that has not started yet suggests today', () => {
    expect(suggestEntryDate(week([]), '2026-08-20')).toBe('2026-08-20');
  });
});

describe('the user’s own week labels and month names', () => {
  it('puts a week label on block and plain weeks, and a name on the month', () => {
    const periods = buildTrainingLogIndex({
      trainingDays: [
        { date: '2026-08-04', sessions: 1 },
        { date: '2026-09-17', sessions: 1 },
      ],
      logDates: [],
      weekNoteStarts: [],
      blocks: [block('b1', 1, '2026-08-03', 1)],
      today: '2026-09-24',
      weekLabels: [
        { weekStart: '2026-08-03', label: 'Heavy' },
        { weekStart: '2026-09-14', label: 'B3W3' },
      ],
      monthNames: [{ monthKey: '2026-09', name: 'Power Lifting' }],
    });
    const sep = periods.find((p) => p.monthKey === '2026-09')!;
    const aug = periods.find((p) => p.monthKey === '2026-08')!;
    expect(sep.monthName).toBe('Power Lifting');
    expect(sep.weeks[0].customLabel).toBe('B3W3');
    expect(aug.weeks[0].customLabel).toBe('Heavy');
  });
});
