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
      'Tháng 9 năm 2026',
      'B1W1: 07.09–13.09 76.3kg',
      '08.09: S 130 4x3x115',
    ]);
    expect(diffOf((t) => t)).toEqual({ days: [], weekNotes: [], weekLabels: [], weekWeights: [], title: null, invalidDates: [] });
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
        .replace('08.09: S 130 4x3x115', '08.09: S 130 4x3x115\nCảm giác nặng')
    );
    expect(d.weekNotes).toEqual([{ weekStart: '2026-09-07', label: 'B1W1', before: '', after: 'ngủ ít' }]);
    expect(d.days[0].after?.note).toBe('Cảm giác nặng');
  });

  it('a new day line, a deleted day line, a future date and a new title', () => {
    const d = diffOf((t) =>
      t
        .replace('Tháng 9 năm 2026', 'Peak')
        .replace('08.09: S 130 4x3x115', '10.09: D 150\n25.09: S 200')
        .replace('15.09: B 5x5x90', '')
    );
    expect(d.title).toEqual({ before: 'Tháng 9 năm 2026', after: 'Peak' });
    expect(d.invalidDates).toEqual(['25.09: S 200']);
    expect(d.days.map((x) => [x.date, x.before?.body ?? null, x.after?.body ?? null])).toEqual([
      ['2026-09-08', 'S 130 4x3x115', null],
      ['2026-09-10', null, 'D 150'],
      ['2026-09-15', 'B 5x5x90', null],
    ]);
  });

  it('English pages are read month-first', () => {
    const d = diffOf((t) => t.replace('09/08: S 130 4x3x115', '09/08: S 135 4x3x115'), 'en');
    expect(d.days.map((x) => x.date)).toEqual(['2026-09-08']);
  });

  it('a weigh-in typed into a day prefix is reported (day lines print none)', () => {
    const d = diffOf((t) => t.replace('08.09:', '08.09(76,1kg):'));
    expect(d.days[0].after?.weightKg).toBe(76.1);
    expect(d.days[0].before?.weightKg).toBeNull();
  });
});

describe('parsePageText — the weight in a week heading', () => {
  it('a changed heading weight is that week’s weigh-in (decimal comma too)', () => {
    const d = diffOf((t) => t.replace('B1W1: 07.09–13.09 76.3kg', 'B1W1: 07.09–13.09 80,5kg'));
    expect(d.weekWeights).toEqual([
      { weekStart: '2026-09-07', weekEnd: '2026-09-13', label: 'B1W1', before: 76.3, after: 80.5 },
    ]);
    expect(d.days).toEqual([]);
  });

  it('a weight typed into a heading that had none is an edit too', () => {
    const d = diffOf((t) => t.replace('B1W2: 14.09–20.09 76.3kg', 'B1W2: 14.09–20.09 79kg'));
    expect(d.weekWeights.map((w) => [w.weekStart, w.before, w.after])).toEqual([['2026-09-14', 76.3, 79]]);
  });

  it('removing the weight, or leaving it, changes nothing', () => {
    expect(diffOf((t) => t.replace('B1W1: 07.09–13.09 76.3kg', 'B1W1: 07.09–13.09')).weekWeights).toEqual([]);
    expect(diffOf((t) => t.replace('76.3kg', '76.30kg')).weekWeights).toEqual([]);
  });
});

describe('parsePageText — week labels typed in front of the dates', () => {
  it('reads "B3W3: <dates> <weight>" in a block as that week’s own label', () => {
    const diff = diffOf((t) => t.replace('B1W2: 14.09–20.09', 'B3W3: 14.09–20.09'));
    expect(diff.weekLabels).toEqual([{ weekStart: '2026-09-14', range: '14.09–20.09', before: '', after: 'B3W3' }]);
    expect(diff.weekNotes).toEqual([]);
    expect(diff.days).toEqual([]);
  });

  it('typing the default label back (any case) is not a label', () => {
    expect(diffOf((t) => t.replace('B1W2:', 'b1w2:')).weekLabels).toEqual([]);
  });

  const free = buildTrainingLogIndex({
    trainingDays: [
      { date: '2026-09-17', sessions: 1 },
      { date: '2026-09-22', sessions: 1 },
    ],
    logDates: [],
    weekNoteStarts: [],
    blocks: [],
    today: '2026-09-24',
  })[0];
  const freeEntries = [
    entry('2026-09-17', [{ type: 'squat', minutes: 30, sets: working(100, [6, 6]) }]),
    entry('2026-09-22', [{ type: 'bench_press', minutes: 30, sets: working(80, [5]) }]),
  ];
  const freeDiff = (edit: (text: string) => string, customLabel?: string) => {
    const withLabel = customLabel
      ? { ...free, weeks: free.weeks.map((w) => (w.weekStart === '2026-09-21' ? { ...w, customLabel } : w)) }
      : free;
    const page = buildPeriodPage({
      period: withLabel,
      entries: freeEntries,
      dayRecords: [],
      weekRecords: [],
      weights: [],
      format: DEFAULT_TRAINING_LOG_FORMAT,
      language: 'vi',
    });
    return {
      page,
      diff: parsePageText({
        page,
        text: edit(page.text),
        rangeStart: withLabel.startDate,
        rangeEnd: withLabel.endDate,
        today: '2026-09-24',
        language: 'vi',
      }),
    };
  };

  it('a free week gets a label (and is no longer a note of the previous day)', () => {
    const { diff } = freeDiff((t) => t.replace('21.09–27.09', 'B3W3: 21.09–27.09'));
    expect(diff.weekLabels).toEqual([{ weekStart: '2026-09-21', range: '21.09–27.09', before: '', after: 'B3W3' }]);
    expect(diff.days).toEqual([]);
  });

  it('accepts a plain hyphen between the dates', () => {
    const { diff } = freeDiff((t) => t.replace('21.09–27.09', 'B3W3: 21.09 - 27.09'));
    expect(diff.weekLabels.map((w) => w.after)).toEqual(['B3W3']);
  });

  it('heals a label line that was saved as a day note: first label wins, the note goes away', () => {
    // What the old parser left behind: the "B3W3: …" line under 17.09.
    const { diff } = freeDiff((t) => t.replace('17.09: S 2x6x100', '17.09: S 2x6x100\nB3W3: 21.09–27.09'));
    expect(diff.weekLabels.map((w) => [w.weekStart, w.after])).toEqual([['2026-09-21', 'B3W3']]);
    expect(diff.days).toEqual([]);
  });

  it('shows the label on the page and removing it clears it', () => {
    const { page, diff } = freeDiff((t) => t.replace('B3W3: 21.09–27.09', '21.09–27.09'), 'B3W3');
    expect(page.text).toContain('B3W3: 21.09–27.09');
    expect(diff.weekLabels).toEqual([{ weekStart: '2026-09-21', range: '21.09–27.09', before: 'B3W3', after: '' }]);
  });

  it('a note line that merely mentions the dates stays a note', () => {
    const { diff } = freeDiff((t) => t.replace('17.09: S 2x6x100', '17.09: S 2x6x100\nnghỉ 21.09–27.09 vì ốm nặng'));
    expect(diff.weekLabels).toEqual([]);
    expect(diff.days.map((d) => d.after?.note)).toEqual(['nghỉ 21.09–27.09 vì ốm nặng']);
  });
});
