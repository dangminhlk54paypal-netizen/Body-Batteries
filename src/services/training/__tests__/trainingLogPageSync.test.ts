import { applyPageEdit, planHasWrites, planPageEdit } from '../trainingLogPageSync';
import type { PageEditWriters } from '../trainingLogPageSync';
import { buildPeriodPage } from '../../../domain/training/trainingLogPage';
import { buildTrainingLogIndex } from '../../../domain/training/trainingLogIndex';
import { getActivityLogForDate } from '../../../data/repositories/activityLogRepository';
import { getTrainingLogDay } from '../../../data/repositories/trainingLogRepository';
import { addDaysToDateString } from '../../../lib/dateUtils';
import { DEFAULT_TRAINING_LOG_FORMAT } from '../../../types/trainingLog';
import type { TrainingLogDayRecord } from '../../../types/trainingLog';
import type { ActivityLogEntry, LiftingSet, WorkoutSession } from '../../../types/energy';
import type { GeneratedBlockPlan } from '../../../types/powerliftingBlock';

jest.mock('../../../data/repositories/activityLogRepository');
jest.mock('../../../data/repositories/trainingLogRepository');

const at = (date: string, h = 18) => new Date(`${date}T${String(h).padStart(2, '0')}:00:00`).getTime();
const working = (weightKg: number, reps: number[]): LiftingSet[] => reps.map((r) => ({ kind: 'working', weightKg, reps: r }));
const entry = (date: string, workouts: WorkoutSession[], energyKcal: number): ActivityLogEntry => ({
  id: date,
  timestamp: at(date),
  steps: 0,
  workouts,
  energyKcal,
  satietyDrainKcal: 0,
  energyDayApplied: date,
});

const block = {
  config: { id: 'b1', createdAt: 1, focus: 'volume' },
  weeks: [
    {
      weekNumber: 1,
      isDeload: false,
      startDate: '2026-09-07',
      endDate: addDaysToDateString('2026-09-07', 6),
      days: [],
      totalKcal: 0,
      weeklyDeficitTargetKcal: null,
    },
  ],
} as unknown as GeneratedBlockPlan;

const period = buildTrainingLogIndex({
  trainingDays: [{ date: '2026-09-08', sessions: 1 }],
  logDates: ['2026-09-09'],
  weekNoteStarts: [],
  blocks: [block],
  today: '2026-09-20',
})[0];

// The database as the test sees it: Xả on 08.09, a hand-written line on 09.09.
let db: { entries: Record<string, ActivityLogEntry[]>; days: Record<string, TrainingLogDayRecord> };

beforeEach(() => {
  db = {
    entries: {
      '2026-09-08': [entry('2026-09-08', [{ type: 'squat', minutes: 30, sets: [...working(130, [1]), ...working(115, [3, 3, 3, 3])] }], 250)],
    },
    days: {
      '2026-09-09': { date: '2026-09-09', overrideText: 'B 90', note: null, sourceSignature: null, updatedAt: 1 },
    },
  };
  jest.mocked(getActivityLogForDate).mockImplementation(async (d) => db.entries[d] ?? []);
  jest.mocked(getTrainingLogDay).mockImplementation(async (d) => db.days[d] ?? null);
});

function writers(): PageEditWriters & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    updateEntry: jest.fn(async (e: ActivityLogEntry, workouts: WorkoutSession[]) => {
      calls.push(`update ${e.id}`);
      // The store would recalculate; the test just bumps the kcal.
      db.entries[e.id] = [{ ...e, workouts, energyKcal: 262 }];
    }),
    createEntry: jest.fn(async (date: string, workouts: WorkoutSession[]) => {
      calls.push(`create ${date}`);
      // The store would compute kcal; the test uses a fixed one.
      db.entries[date] = [{ ...entry(date, workouts, 180), id: `new_${date}` }];
    }),
    writeNotebook: jest.fn(async () => {
      calls.push('notebook');
    }),
    renameMonth: jest.fn(async (monthKey: string, name: string) => {
      calls.push(`month ${monthKey} ${name}`);
    }),
    setDayWeight: jest.fn(async (date: string, kg: number) => {
      calls.push(`weight ${date} ${kg}`);
    }),
    setWeekWeight: jest.fn(async (weekStart: string, weekEnd: string, kg: number) => {
      calls.push(`weekWeight ${weekStart}–${weekEnd} ${kg}`);
    }),
  };
}

const page = () =>
  buildPeriodPage({
    period,
    entries: db.entries['2026-09-08'],
    dayRecords: Object.values(db.days),
    weekRecords: [],
    weights: [],
    format: DEFAULT_TRAINING_LOG_FORMAT,
    language: 'vi',
  });

const planFor = (edit: (t: string) => string) => {
  const p = page();
  return planPageEdit({ period, page: p, text: edit(p.text), format: DEFAULT_TRAINING_LOG_FORMAT, language: 'vi', today: '2026-09-20' });
};

describe('page edit → Xả + notebook', () => {
  it('previews first (writes nothing), then applies and reports kcal before → after', async () => {
    const plan = await planFor((t) => t.replace('S 130 4x3x115', 'S 132.5 4x3x115').replace('09.09: B 90', '09.09: B 92.5'));
    expect(plan.changes.map((c) => [c.date, c.target, c.before, c.after])).toEqual([
      ['2026-09-08', 'xa', 'S 130 4x3x115', 'S 132.5 4x3x115'],
      // 09.09 had only a hand-written line; a readable edit makes it a real session.
      ['2026-09-09', 'xaCreate', 'B 90', 'B 92.5'],
    ]);
    expect(plan.changes[0].kcalBefore).toBe(250);
    expect(planHasWrites(plan)).toBe(true);

    const w = writers();
    const done = await applyPageEdit(plan, w);
    expect(w.calls).toEqual(['update 2026-09-08', 'create 2026-09-09', 'notebook']);
    expect(done[0]).toMatchObject({ target: 'xa', kcalBefore: 250, kcalAfter: 262 });
    expect(done[1]).toMatchObject({ target: 'xaCreate', kcalBefore: 0, kcalAfter: 180 });
    expect(jest.mocked(w.createEntry).mock.calls[0][1][0]).toMatchObject({
      type: 'bench_press',
      sets: [{ kind: 'working', weightKg: 92.5, reps: 1 }],
    });
    const updated = jest.mocked(w.updateEntry).mock.calls[0][1];
    expect(updated[0].sets?.[0]).toEqual({ kind: 'working', weightKg: 132.5, reps: 1 });
    expect(jest.mocked(w.writeNotebook).mock.calls[0][0]).toEqual({
      // The new session prints "B 92.5" itself → the hand-written text is no longer needed.
      days: [{ date: '2026-09-09', overrideText: null, note: null, sourceSignature: null }],
      deleteDates: [],
      weeks: [],
    });
  });

  it('keeps an annotated line bound to the NEW entries (no conflict banner afterwards)', async () => {
    const plan = await planFor((t) => t.replace('S 130 4x3x115', 'S 130 (135 ❌) 5x3x115'));
    const w = writers();
    await applyPageEdit(plan, w);
    const day = jest.mocked(w.writeNotebook).mock.calls[0][0].days[0];
    expect(day.overrideText).toBe('S 130 (135 ❌) 5x3x115');
    expect(day.sourceSignature).not.toBeNull();
  });

  it('never deletes Xả: a removed Xả line is reported and skipped; a removed hand-written line is deleted', async () => {
    const plan = await planFor((t) => t.replace('08.09: S 130 4x3x115', '').replace('09.09: B 90', ''));
    expect(plan.changes.map((c) => [c.target, c.reason])).toEqual([
      ['skipped', 'xaLineRemoved'],
      ['manualRemoved', undefined],
    ]);
    const w = writers();
    await applyPageEdit(plan, w);
    expect(w.updateEntry).not.toHaveBeenCalled();
    expect(jest.mocked(w.writeNotebook).mock.calls[0][0].deleteDates).toEqual(['2026-09-09']);
  });

  it('an unreadable line saves text only and says why', async () => {
    const plan = await planFor((t) => t.replace('S 130 4x3x115', 'S 130 4x3x115(+8)'));
    expect(plan.changes[0]).toMatchObject({ target: 'lineText', reason: 'unparsed' });
    const w = writers();
    await applyPageEdit(plan, w);
    expect(w.updateEntry).not.toHaveBeenCalled();
  });

  it('a weight typed in front of a day is saved as that day’s weigh-in', async () => {
    const plan = await planFor((t) => t.replace('08.09: S 130 4x3x115', '08.09(79,5kg): S 130 4x3x115'));
    expect(plan.changes.map((c) => [c.date, c.target, c.before, c.after])).toEqual([['2026-09-08', 'weight', '', '79.5']]);
    expect(planHasWrites(plan)).toBe(true);
    const w = writers();
    await applyPageEdit(plan, w);
    expect(w.calls).toEqual(['weight 2026-09-08 79.5', 'notebook']); // the notebook reload redraws the chart
    expect(w.updateEntry).not.toHaveBeenCalled(); // Xả untouched
  });

  it('a weight typed in a week heading is saved as that week’s weigh-in', async () => {
    const plan = await planFor((t) => t.replace(/(B1W1: 07\.09–13\.09)[^\n]*/, '$1 80kg'));
    expect(plan.changes.map((c) => [c.target, c.weekLabel, c.after])).toEqual([['weekWeight', 'B1W1', '80']]);
    const w = writers();
    await applyPageEdit(plan, w);
    expect(w.calls).toEqual(['weekWeight 2026-09-07–2026-09-13 80', 'notebook']);
  });

  it('a day with only a weight works too; an impossible weight is skipped with a reason', async () => {
    const plan = await planFor((t) => `${t}\n10.09(78kg):`.replace('09.09: B 90', '09.09(7kg): B 90'));
    expect(plan.changes.map((c) => [c.date, c.target, c.reason])).toEqual([
      ['2026-09-09', 'skipped', 'weightInvalid'],
      ['2026-09-10', 'weight', undefined],
    ]);
    const w = writers();
    await applyPageEdit(plan, w);
    expect(w.calls).toContain('weight 2026-09-10 78');
    expect(w.calls.filter((c) => c.startsWith('weight'))).toHaveLength(1);
  });

  it('the page title names the month (a block has no section of its own any more)', async () => {
    const plan = await planFor((t) => t.replace('Tháng 9 năm 2026', 'Peak'));
    const w = writers();
    await applyPageEdit(plan, w);
    expect(w.calls[0]).toBe('month 2026-09 Peak');
  });

  it('"Ghi dòng tay vào Xả": unchanged hand-written lines become sessions; Xả days are left alone', async () => {
    const p = page();
    const plan = await planPageEdit({
      period,
      page: p,
      text: p.text,
      format: DEFAULT_TRAINING_LOG_FORMAT,
      language: 'vi',
      today: '2026-09-20',
      backfillManual: true,
    });
    expect(plan.changes.map((c) => [c.date, c.target, c.before, c.after])).toEqual([
      ['2026-09-09', 'xaCreate', '', 'B 90'],
    ]);
    const w = writers();
    await applyPageEdit(plan, w);
    expect(w.calls).toEqual(['create 2026-09-09', 'notebook']);
  });

  it('"Ghi dòng tay vào Xả": an unreadable hand-written line is reported, nothing written for it', async () => {
    db.days['2026-09-09'].overrideText = 'đi bơi 30 phút';
    const p = page();
    const plan = await planPageEdit({
      period,
      page: p,
      text: p.text,
      format: DEFAULT_TRAINING_LOG_FORMAT,
      language: 'vi',
      today: '2026-09-20',
      backfillManual: true,
    });
    expect(plan.changes.map((c) => [c.target, c.reason])).toEqual([['skipped', 'unparsedManual']]);
    expect(planHasWrites(plan)).toBe(false);
  });

  it('a week label typed on the page is one weekLabel change, written with the week', async () => {
    const plan = await planFor((t) => t.replace('B1W1: 07.09–13.09', 'Heavy: 07.09–13.09'));
    expect(plan.changes.map((c) => [c.target, c.weekLabel, c.before, c.after])).toEqual([
      ['weekLabel', '07.09–13.09', '', 'Heavy'],
    ]);
    const w = writers();
    await applyPageEdit(plan, w);
    expect(jest.mocked(w.writeNotebook).mock.calls[0][0].weeks).toEqual([{ weekStart: '2026-09-07', label: 'Heavy' }]);
  });

  it('a note and a label on the same week become ONE week write', async () => {
    const plan = await planFor((t) => t.replace('B1W1: 07.09–13.09', 'Heavy: 07.09–13.09\nngủ ít'));
    const w = writers();
    await applyPageEdit(plan, w);
    expect(jest.mocked(w.writeNotebook).mock.calls[0][0].weeks).toEqual([
      { weekStart: '2026-09-07', note: 'ngủ ít', label: 'Heavy' },
    ]);
  });

  it('a free month can be renamed from the page title; the default title back clears it', async () => {
    const free = buildTrainingLogIndex({
      trainingDays: [{ date: '2026-09-08', sessions: 1 }],
      logDates: [],
      weekNoteStarts: [],
      blocks: [],
      today: '2026-09-20',
    })[0];
    const run = async (from: typeof free, title: string) => {
      const p = buildPeriodPage({
        period: from,
        entries: db.entries['2026-09-08'],
        dayRecords: [],
        weekRecords: [],
        weights: [],
        format: DEFAULT_TRAINING_LOG_FORMAT,
        language: 'vi',
      });
      const text = [title, ...p.text.split('\n').slice(1)].join('\n');
      const plan = await planPageEdit({ period: from, page: p, text, format: DEFAULT_TRAINING_LOG_FORMAT, language: 'vi', today: '2026-09-20' });
      const w = writers();
      await applyPageEdit(plan, w);
      return { plan, w };
    };

    const renamed = await run(free, 'Power Lifting');
    expect(renamed.plan.changes.map((c) => [c.target, c.after])).toEqual([['monthName', 'Power Lifting']]);
    expect(renamed.w.calls[0]).toBe('month 2026-09 Power Lifting');

    const named = { ...free, monthName: 'Power Lifting' };
    const cleared = await run(named, 'Tháng 9 năm 2026');
    expect(cleared.w.calls[0]).toBe('month 2026-09 ');
  });

  it('a failed recalculation is reported and leaves that day’s notebook record alone', async () => {
    const plan = await planFor((t) => t.replace('S 130 4x3x115', 'S 135 4x3x115'));
    const w = writers();
    jest.mocked(w.updateEntry).mockRejectedValueOnce(new Error('db busy'));
    const done = await applyPageEdit(plan, w);
    expect(done[0]).toMatchObject({ reason: 'failed', detail: 'db busy' });
    expect(jest.mocked(w.writeNotebook).mock.calls[0][0].days).toEqual([]);
  });
});
