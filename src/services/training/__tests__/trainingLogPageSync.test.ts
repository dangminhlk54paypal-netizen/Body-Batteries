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
    writeNotebook: jest.fn(async () => {
      calls.push('notebook');
    }),
    renameBlock: jest.fn(async (id: string, name: string) => {
      calls.push(`rename ${id} ${name}`);
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
      ['2026-09-09', 'manualLine', 'B 90', 'B 92.5'],
    ]);
    expect(plan.changes[0].kcalBefore).toBe(250);
    expect(planHasWrites(plan)).toBe(true);

    const w = writers();
    const done = await applyPageEdit(plan, w);
    expect(w.calls).toEqual(['update 2026-09-08', 'notebook']);
    expect(done[0]).toMatchObject({ target: 'xa', kcalBefore: 250, kcalAfter: 262 });
    const updated = jest.mocked(w.updateEntry).mock.calls[0][1];
    expect(updated[0].sets?.[0]).toEqual({ kind: 'working', weightKg: 132.5, reps: 1 });
    expect(jest.mocked(w.writeNotebook).mock.calls[0][0]).toEqual({
      days: [{ date: '2026-09-09', overrideText: 'B 92.5', note: null, sourceSignature: null }],
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

  it('renames the block from the page title', async () => {
    const plan = await planFor((t) => t.replace('Block 1', 'Block2 Peak'));
    const w = writers();
    await applyPageEdit(plan, w);
    expect(w.calls[0]).toBe('rename b1 Block2 Peak');
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
