import { buildPeriodText } from '../trainingLogPage';
import type { PeriodPageInput } from '../trainingLogPage';
import { buildTrainingLogIndex } from '../trainingLogIndex';
import { addDaysToDateString } from '../../../lib/dateUtils';
import { DEFAULT_TRAINING_LOG_FORMAT } from '../../../types/trainingLog';
import type { TrainingLogFormat, TrainingLogPeriod } from '../../../types/trainingLog';
import type { ActivityLogEntry, LiftingSet, WorkoutSession } from '../../../types/energy';
import type { GeneratedBlockPlan } from '../../../types/powerliftingBlock';

const at = (date: string, h = 18) => new Date(`${date}T${String(h).padStart(2, '0')}:00:00`).getTime();
const working = (weightKg: number, reps: number[]): LiftingSet[] => reps.map((r) => ({ kind: 'working', weightKg, reps: r }));
const entry = (date: string, workouts: WorkoutSession[], id = date): ActivityLogEntry => ({
  id,
  timestamp: at(date),
  steps: 0,
  workouts,
  energyKcal: 0,
  satietyDrainKcal: 0,
  energyDayApplied: date,
});

// The user's real Block 2, weeks 1-2 (Monday 2026-07-27).
const block2 = {
  config: { id: 'b2', createdAt: 2, focus: 'volume' },
  weeks: [0, 1].map((i) => ({
    weekNumber: i + 1,
    isDeload: false,
    startDate: addDaysToDateString('2026-07-27', i * 7),
    endDate: addDaysToDateString('2026-07-27', i * 7 + 6),
    days: [],
    totalKcal: 0,
    weeklyDeficitTargetKcal: null,
  })),
} as unknown as GeneratedBlockPlan;

const dl = (top: number, w: number) => ({ type: 'deadlift' as const, minutes: 30, sets: [...working(top, [1]), ...working(w, [5, 5, 5, 5, 5])] });
const ps = (top: number, w: number) => ({
  type: 'squat' as const,
  minutes: 30,
  variationId: 'squat_paused',
  sets: [...working(top, [1]), ...working(w, [5, 5, 5, 5, 5])],
});
const bench = (top: number, w: number) => ({ type: 'bench_press' as const, minutes: 30, sets: [...working(top, [1]), ...working(w, [5, 5, 5, 5, 5])] });
const incline = (w: number) => ({ type: 'bench_press' as const, minutes: 20, variationId: 'bench_incline', sets: working(w, [5, 5, 5, 5, 5]) });

function period(over: Partial<{ trainingDays: { date: string; sessions: number }[]; today: string }> = {}): TrainingLogPeriod {
  return buildTrainingLogIndex({
    trainingDays: [
      { date: '2026-07-26', sessions: 1 }, // (before the block: not used)
      { date: '2026-07-27', sessions: 1 },
      { date: '2026-07-29', sessions: 1 },
      { date: '2026-08-03', sessions: 1 },
    ],
    logDates: [],
    weekNoteStarts: [],
    blocks: [block2],
    today: '2026-08-09',
    ...over,
  }).find((p) => p.kind === 'block')!;
}

const base = (p: TrainingLogPeriod, over: Partial<PeriodPageInput> = {}): PeriodPageInput => ({
  period: p,
  entries: [],
  dayRecords: [],
  weekRecords: [],
  weights: [],
  format: DEFAULT_TRAINING_LOG_FORMAT,
  language: 'vi',
  ...over,
});
const fmt = (patch: Partial<TrainingLogFormat>): TrainingLogFormat => ({ ...DEFAULT_TRAINING_LOG_FORMAT, ...patch });

describe('buildPeriodText — the notebook page as plain text', () => {
  const entries = [
    entry('2026-07-27', [bench(90, 72.5), incline(62.5)]),
    entry('2026-07-29', [ps(110, 85)]),
    entry('2026-08-03', [dl(100, 80)]),
  ];

  it('lays out title, week headings and day lines like the user’s Notes', () => {
    const text = buildPeriodText(base(period(), { entries }));
    expect(text).toBe(
      [
        'Block 1',
        'W1:',
        '27.07: B 90 5x5x72.5 iC 5x5x62.5',
        '29.07: PS 110 5x5x85',
        '',
        'W2:',
        '03.08: D 100 5x5x80',
      ].join('\n')
    );
  });

  it('uses the user’s block name, week weight, day weight, notes and overrides', () => {
    const named = { ...block2, config: { ...block2.config, name: 'Block2 Accumulation' } } as GeneratedBlockPlan;
    const p = buildTrainingLogIndex({
      trainingDays: [
        { date: '2026-07-27', sessions: 1 },
        { date: '2026-08-03', sessions: 1 },
      ],
      logDates: ['2026-07-27'],
      weekNoteStarts: ['2026-07-27'],
      blocks: [named],
      today: '2026-08-09',
    })[0];
    const text = buildPeriodText(
      base(p, {
        entries: [entry('2026-07-27', [bench(90, 72.5)]), entry('2026-08-03', [dl(100, 80)])],
        dayRecords: [
          { date: '2026-07-27', overrideText: 'B 90 (95 ❌) 5x5x72.5', note: 'Cảm giác quá tải thần kinh', sourceSignature: 'x', updatedAt: 1 },
        ],
        weekRecords: [{ weekStart: '2026-07-27', note: 'ngủ ít', updatedAt: 1 }],
        weights: [
          { timestamp: at('2026-07-28', 8), value: 77.5 },
          { timestamp: at('2026-08-03', 8), value: 77 },
        ],
      })
    );
    expect(text).toBe(
      [
        'Block2 Accumulation',
        'W1: 77.5kg',
        'ngủ ít',
        '27.07: B 90 (95 ❌) 5x5x72.5',
        'Cảm giác quá tải thần kinh',
        '',
        'W2: 77kg',
        '03.08(77kg): D 100 5x5x80',
      ].join('\n')
    );
  });

  it('prints a hand-written day, and a note-only day as just its date + note', () => {
    const withLog = buildTrainingLogIndex({
      trainingDays: [],
      logDates: ['2026-07-28', '2026-07-30'],
      weekNoteStarts: [],
      blocks: [block2],
      today: '2026-08-09',
    })[0];
    const text = buildPeriodText(
      base(withLog, {
        dayRecords: [
          { date: '2026-07-28', overrideText: 'S 120 5x4x100 PD 4x3x80', note: null, sourceSignature: null, updatedAt: 1 },
          { date: '2026-07-30', overrideText: null, note: 'nghỉ ốm', sourceSignature: null, updatedAt: 1 },
        ],
      })
    );
    expect(text.split('\n').slice(0, 5)).toEqual([
      'Block 1',
      'W1:',
      '28.07: S 120 5x4x100 PD 4x3x80',
      '30.07:',
      'nghỉ ốm',
    ]);
  });

  it('an empty week shows the dash placeholder', () => {
    const text = buildPeriodText(base(period({ trainingDays: [{ date: '2026-07-27', sessions: 1 }] }), {
      entries: [entry('2026-07-27', [dl(100, 80)])],
    }));
    expect(text.endsWith('W2:\n—')).toBe(true);
  });

  it('follows the format options (full names, decimal style, kg)', () => {
    const text = buildPeriodText(
      base(period(), { entries, format: fmt({ decimal: 'locale', showUnit: true }) })
    );
    expect(text).toContain('27.07: B 90kg 5x5x72,5kg iC 5x5x62,5kg');
  });

  it('a free period is titled with its month', () => {
    const free = buildTrainingLogIndex({
      trainingDays: [{ date: '2026-06-17', sessions: 1 }],
      logDates: [],
      weekNoteStarts: [],
      blocks: [],
      today: '2026-08-09',
    })[0];
    const text = buildPeriodText(base(free, { entries: [entry('2026-06-17', [dl(120, 100)])] }));
    const [title, weekLine, dayLine] = text.split('\n');
    expect(title).toMatch(/^Tập tự do · /);
    expect(weekLine).toBe('15.06–21.06'); // no colon: a date range, not "W1:"
    expect(dayLine).toBe('17.06: D 120 5x5x100');
  });

  it('is language aware: dates are written month-first in English', () => {
    const text = buildPeriodText(base(period(), { entries, language: 'en' }));
    expect(text.split('\n')[2]).toBe('07/27: B 90 5x5x72.5 iC 5x5x62.5');
  });
});
