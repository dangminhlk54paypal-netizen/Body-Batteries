import { backfillTimestamp, planDaySync } from '../trainingLogDaySync';
import { DEFAULT_TRAINING_LOG_FORMAT } from '../../../types/trainingLog';
import type { TrainingLogFormat } from '../../../types/trainingLog';
import type { ActivityLogEntry, LiftingSet, WorkoutSession } from '../../../types/energy';

// Most cases below are about lines without a prime; the prime has its own block.
const FMT: TrainingLogFormat = { ...DEFAULT_TRAINING_LOG_FORMAT, showPrime: false };
const WITH_PRIME: TrainingLogFormat = DEFAULT_TRAINING_LOG_FORMAT;
const working = (weightKg: number, reps: number[]): LiftingSet[] =>
  reps.map((r) => ({ kind: 'working', weightKg, reps: r }));
const warm = (weightKg: number, reps: number): LiftingSet => ({ kind: 'warmup', weightKg, reps });
const same = (n: number, r: number) => Array<number>(n).fill(r);

const entry = (id: string, workouts: WorkoutSession[], timestamp = 1_000): ActivityLogEntry => ({
  id,
  timestamp,
  steps: 0,
  workouts,
  energyKcal: 300,
  satietyDrainKcal: 0,
  energyDayApplied: '2026-09-08',
});

const squat: WorkoutSession = {
  type: 'squat',
  minutes: 40,
  sets: [warm(60, 5), warm(100, 3), ...working(130, [1]), ...working(115, same(4, 3))],
};
const pausedDl: WorkoutSession = {
  type: 'deadlift',
  minutes: 25,
  variationId: 'deadlift_paused',
  sets: working(100, same(4, 3)),
};
const run: WorkoutSession = { type: 'running', minutes: 30 };

const plan = (entries: ActivityLogEntry[], newBody: string, format = FMT) =>
  planDaySync({ date: '2026-09-08', entries, newBody, format, language: 'vi' });

describe('planDaySync — a corrected day line applied back to Xả', () => {
  it('a changed number rebuilds that lift, keeps its warm-ups, leaves the rest untouched', () => {
    const e = entry('e1', [squat, pausedDl]);
    // was "S 130 4x3x115 PD 4x3x100"
    const p = plan([e], 'S 132.5 4x3x115 PD 4x3x100');
    expect(p.kind).toBe('sync');
    if (p.kind !== 'sync') return;
    expect(p.updates).toHaveLength(1);
    const [s, dl] = p.updates[0].workouts;
    expect(s.sets).toEqual([warm(60, 5), warm(100, 3), ...working(132.5, [1]), ...working(115, same(4, 3))]);
    expect(dl).toBe(pausedDl); // untouched, same object
    expect(p.override).toBeNull(); // the auto line now says exactly this
  });

  it('adds a missing lift and removes a deleted one', () => {
    const e = entry('e1', [squat, pausedDl]);
    const p = plan([e], 'S 130 4x3x115 B 90 5x5x72.5');
    if (p.kind !== 'sync') throw new Error(p.kind);
    const types = p.updates[0].workouts.map((w) => [w.type, w.variationId]);
    expect(types).toEqual([
      ['squat', undefined],
      ['bench_press', undefined],
    ]);
    expect(p.updates[0].workouts[0]).toBe(squat);
  });

  it('keeps the user’s annotations as their own line while still updating Xả', () => {
    const e = entry('e1', [squat]);
    const p = plan([e], 'S 130 (135 ❌) 5x3x115');
    if (p.kind !== 'sync') throw new Error(p.kind);
    expect(p.updates[0].workouts[0].sets?.filter((s) => s.kind === 'working')).toEqual([
      ...working(130, [1]),
      ...working(115, same(5, 3)),
    ]);
    expect(p.annotations).toEqual(['(135 ❌)']);
    expect(p.override).toBe('S 130 (135 ❌) 5x3x115');
  });

  it('only an annotation added → nothing to recalculate, the text becomes the line', () => {
    const e = entry('e1', [squat]);
    const p = plan([e], 'S 130 4x3x115 (rpe9)');
    if (p.kind !== 'sync') throw new Error(p.kind);
    expect(p.updates).toEqual([]);
    expect(p.override).toBe('S 130 4x3x115 (rpe9)');
  });

  it('non-lifting movements written as before survive the edit', () => {
    const e = entry('e1', [squat, run]);
    const p = plan([e], 'S 130 4x3x116 Chạy bộ 30 phút');
    if (p.kind !== 'sync') throw new Error(p.kind);
    expect(p.updates[0].workouts[1]).toBe(run);
  });

  it('anything it cannot read → text only, Xả untouched', () => {
    const e = entry('e1', [squat]);
    const p = plan([e], 'S 130 4x3x100(+8)');
    expect(p).toMatchObject({ kind: 'textOnly', reason: 'unparsed' });
  });

  it('refuses to empty a whole Xả entry (that is a delete)', () => {
    const a = entry('a', [squat], 1_000);
    const b = entry('b', [pausedDl], 2_000);
    const p = plan([a, b], 'S 130 4x3x115');
    expect(p).toMatchObject({ kind: 'textOnly', reason: 'wouldEmpty' });
  });

  it('with two entries, a changed lift stays in the entry it came from', () => {
    const a = entry('a', [squat], 1_000);
    const b = entry('b', [pausedDl], 2_000);
    const p = plan([a, b], 'S 130 4x3x115 PD 4x3x105');
    if (p.kind !== 'sync') throw new Error(p.kind);
    expect(p.updates.map((u) => u.entry.id)).toEqual(['b']);
    expect(p.updates[0].workouts[0].variationId).toBe('deadlift_paused');
  });

  it('with warm-ups shown, an unchanged ramp is recognized as warm-ups', () => {
    const format = { ...FMT, showWarmups: true };
    const e = entry('e1', [squat]);
    // auto: "S 5x60+3x100 130 4x3x115"
    const p = plan([e], 'S 5x60+3x100 130 5x3x115', format);
    if (p.kind !== 'sync') throw new Error(p.kind);
    expect(p.updates[0].workouts[0].sets).toEqual([
      warm(60, 5),
      warm(100, 3),
      ...working(130, [1]),
      ...working(115, same(5, 3)),
    ]);
  });

  it('no Xả that day, a fully readable line → a NEW Xả session (commas normalized)', () => {
    const p = plan([], 'S 120 5x4x72,5');
    expect(p.kind).toBe('create');
    if (p.kind !== 'create') return;
    expect(p.workouts).toHaveLength(1);
    expect(p.workouts[0].type).toBe('squat');
    expect(p.workouts[0].sets).toEqual([
      { kind: 'working', weightKg: 120, reps: 1 },
      ...working(72.5, same(5, 4)),
    ]);
    expect(p.workouts[0].minutes).toBeGreaterThan(0);
    // The auto line of the new session prints exactly this → no override kept.
    expect(p.override).toBeNull();
  });

  it('no Xả that day, a variation keeps its identity', () => {
    const p = plan([], 'PD 4x3x100');
    expect(p.kind === 'create' && p.workouts[0]).toMatchObject({ type: 'deadlift', variationId: expect.any(String) });
  });

  it('no Xả that day, annotations are kept as the user’s line', () => {
    const p = plan([], 'S 120 (130 ❌) 5x4x72.5');
    expect(p).toMatchObject({ kind: 'create', override: 'S 120 (130 ❌) 5x4x72.5' });
  });

  it('no Xả that day, an unreadable part → hand-written only, saying what', () => {
    expect(plan([], 'S 120 5x4x72,5 chạy bộ')).toMatchObject({ kind: 'manual', unparsed: expect.arrayContaining([expect.stringContaining('chạy')]) });
    expect(plan([], '')).toEqual({ kind: 'manual', override: '', unparsed: [] });
  });

  it('an emptied line on a Xả day never deletes Xả', () => {
    expect(plan([entry('e1', [squat])], '  ')).toEqual({ kind: 'blankXa' });
  });
});

describe('planDaySync — the prime ("S 3x100 + 130 4x3x115")', () => {
  it('an unchanged prime keeps every warm-up; a changed volume rebuilds only the working sets', () => {
    const e = entry('e1', [squat, pausedDl]);
    // prints "S 3x100 + 130 4x3x115 PD 4x3x100"
    const p = plan([e], 'S 3x100 + 130 4x3x117.5 PD 4x3x100', WITH_PRIME);
    if (p.kind !== 'sync') throw new Error(p.kind);
    expect(p.updates[0].workouts[0].sets).toEqual([
      warm(60, 5),
      warm(100, 3),
      ...working(130, [1]),
      ...working(117.5, same(4, 3)),
    ]);
    expect(p.override).toBeNull();
  });

  it('a changed prime replaces the heaviest warm-up, never becomes a working set', () => {
    const e = entry('e1', [squat, pausedDl]);
    const p = plan([e], 'S 105 + 130 4x3x115 PD 4x3x100', WITH_PRIME);
    if (p.kind !== 'sync') throw new Error(p.kind);
    expect(p.updates[0].workouts[0].sets).toEqual([warm(60, 5), warm(105, 1), ...working(130, [1]), ...working(115, same(4, 3))]);
  });

  it('the untouched line is no change at all', () => {
    const e = entry('e1', [squat, pausedDl]);
    const p = plan([e], 'S 3x100 + 130 4x3x115 PD 4x3x100', WITH_PRIME);
    if (p.kind !== 'sync') throw new Error(p.kind);
    expect(p.updates).toEqual([]);
  });

  it('no Xả that day: "B 95+ 4x6x72.5" logs a 95 kg warm-up and the volume', () => {
    const p = plan([], 'B 95+ 4x6x72.5', WITH_PRIME);
    if (p.kind !== 'create') throw new Error(p.kind);
    expect(p.workouts[0].sets).toEqual([warm(95, 1), ...working(72.5, same(4, 6))]);
  });
});

describe('backfillTimestamp', () => {
  it('18:00 of a past day, never later than now', () => {
    const now = new Date('2026-09-24T09:30:00').getTime();
    expect(backfillTimestamp('2026-08-12', now)).toBe(new Date('2026-08-12T18:00:00').getTime());
    expect(backfillTimestamp('2026-09-24', now)).toBe(now);
  });
});
