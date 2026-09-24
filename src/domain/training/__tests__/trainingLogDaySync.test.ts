import { planDaySync } from '../trainingLogDaySync';
import { DEFAULT_TRAINING_LOG_FORMAT } from '../../../types/trainingLog';
import type { TrainingLogFormat } from '../../../types/trainingLog';
import type { ActivityLogEntry, LiftingSet, WorkoutSession } from '../../../types/energy';

const FMT: TrainingLogFormat = DEFAULT_TRAINING_LOG_FORMAT;
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

  it('no Xả that day → a hand-written line (commas normalized)', () => {
    expect(plan([], 'S 120 5x4x72,5')).toEqual({ kind: 'manual', override: 'S 120 5x4x72.5' });
  });

  it('an emptied line on a Xả day never deletes Xả', () => {
    expect(plan([entry('e1', [squat])], '  ')).toEqual({ kind: 'blankXa' });
  });
});
