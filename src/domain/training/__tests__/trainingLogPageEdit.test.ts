import { parsePageText } from '../trainingLogPageEdit';
import { buildPeriodPage } from '../trainingLogPage';
import { buildTrainingLogIndex } from '../trainingLogIndex';
import { addDaysToDateString } from '../../../lib/dateUtils';
import { DEFAULT_TRAINING_LOG_FORMAT } from '../../../types/trainingLog';
import type { ActivityLogEntry, LiftingSet, WorkoutSession } from '../../../types/energy';
import type { GeneratedBlockPlan } from '../../../types/powerliftingBlock';
import type { Language } from '../../../i18n/types';

const at = (date: string, h = 18) => new Date(`${date}T${String(h).padStart(2, '0')}:00:00`).getTime();
const working = (weightKg: number, reps: number[]): LiftingSet[] => reps.map((r) => ({ kind: 'working', weightKg, reps: r }));
const entry = (date: string, workouts: WorkoutSession[]): ActivityLogEntry => ({
  id: date,
  timestamp: at(date),
  steps: 0,
  workouts,
  energyKcal: 0,
  satietyDrainKcal: 0,
  energyDayApplied: date,
});
const block = {
  config: { id: 'b2', createdAt: 2, focus: 'volume' },
  weeks: [0, 1].map((i) => ({
    weekNumber: i + 1,
    isDeload: false,
    startDate: addDaysToDateString('2026-09-07', i * 7),
    endDate: addDaysToDateString('2026-09-07', i * 7 + 6),
    days: [],
    totalKcal: 0,
    weeklyDeficitTargetKcal: null,
  })),
} as unknown as GeneratedBlockPlan;

const period = buildTrainingLogIndex({
  trainingDays: [
    { date: '2026-09-08', sessions: 1 },
    { date: '2026-09-15', sessions: 1 },
  ],
  logDates: [],
  weekNoteStarts: [],
  blocks: [block],
  today: '2026-09-20',
})[0];

const entries = [
  entry('2026-09-08', [{ type: 'squat', minutes: 30, sets: [...working(130, [1]), ...working(115, [3, 3, 3, 3])] }]),
  entry('2026-09-15', [{ type: 'bench_press', minutes: 30, sets: working(90, [5, 5, 5, 5, 5]) }]),
];

const pageFor = (language: Language = 'vi') =>
  buildPeriodPage({
    period,
    entries,
    dayRecords: [],
    weekRecords: [],
    weights: [{ timestamp: at('2026-09-08', 7), value: 76.3 }],
    format: DEFAULT_TRAINING_LOG_FORMAT,
    language,
  });

const diffOf = (edit: (text: string) => string, language: Language = 'vi') => {
  const page = pageFor(language);
  return parsePageText({
    page,
    text: edit(page.text),
    rangeStart: period.startDate,
    rangeEnd: period.endDate,
    today: '2026-09-20',
    language,
  });
};

describe('parsePageText — what the user changed on the page', () => {
  it('the page itself is B2W1-style and unchanged text means no change', () => {
    const page = pageFor();
    expect(page.text.split('\n').slice(0, 3)).toEqual([
      'Block 1',
      'B1W1: 07.09–13.09 76.3kg',
      '08.09(76.3kg): S 130 4x3x115',
    ]);
    expect(diffOf((t) => t)).toEqual({ days: [], weekNotes: [], title: null, invalidDates: [] });
  });

  it('a corrected number is a day edit with before/after bodies', () => {
    const d = diffOf((t) => t.replace('S 130 4x3x115', 'S 132.5 4x3x115'));
    expect(d.days).toHaveLength(1);
    expect(d.days[0].date).toBe('2026-09-08');
    expect(d.days[0].before?.body).toBe('S 130 4x3x115');
    expect(d.days[0].after?.body).toBe('S 132.5 4x3x115');
  });

  it('a line under a day is its note; a line under a heading is the week note', () => {
    const d = diffOf((t) =>
      t
        .replace('B1W1: 07.09–13.09 76.3kg', 'B1W1: 07.09–13.09 76.3kg\nngủ ít')
        .replace('08.09(76.3kg): S 130 4x3x115', '08.09(76.3kg): S 130 4x3x115\nCảm giác nặng')
    );
    expect(d.weekNotes).toEqual([{ weekStart: '2026-09-07', label: 'B1W1', before: '', after: 'ngủ ít' }]);
    expect(d.days[0].after?.note).toBe('Cảm giác nặng');
  });

  it('a new day line, a deleted day line, a future date and a new title', () => {
    const d = diffOf((t) =>
      t
        .replace('Block 1', 'Block2 Peak')
        .replace('08.09(76.3kg): S 130 4x3x115', '10.09: D 150\n25.09: S 200')
        .replace('15.09: B 5x5x90', '')
    );
    expect(d.title).toEqual({ before: 'Block 1', after: 'Block2 Peak' });
    expect(d.invalidDates).toEqual(['25.09: S 200']);
    expect(d.days.map((x) => [x.date, x.before?.body ?? null, x.after?.body ?? null])).toEqual([
      ['2026-09-08', 'S 130 4x3x115', null],
      ['2026-09-10', null, 'D 150'],
      ['2026-09-15', 'B 5x5x90', null],
    ]);
  });

  it('English pages are read month-first', () => {
    const d = diffOf((t) => t.replace('09/08(76.3kg): S 130 4x3x115', '09/08(76.3kg): S 135 4x3x115'), 'en');
    expect(d.days.map((x) => x.date)).toEqual(['2026-09-08']);
  });

  it('a changed weigh-in in the prefix is reported', () => {
    const d = diffOf((t) => t.replace('08.09(76.3kg):', '08.09(76,1kg):'));
    expect(d.days[0].after?.weightKg).toBe(76.1);
    expect(d.days[0].before?.weightKg).toBe(76.3);
  });
});
