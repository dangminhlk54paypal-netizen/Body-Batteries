import {
  emptyMovement,
  movementSets,
  movementsFromEntry,
  movementsToWorkouts,
  nextMovementKey,
  findPrevSessionForMovement,
  variationIdentity,
  selectableVariationIds,
  suggestNextVariationId,
} from '../liftingMovements';
import type { MovementDraft } from '../liftingMovements';
import type { ActivityLogEntry, LiftingSet, WorkoutSession } from '../../../types/energy';

const rows = (weight: string, reps: string, n = 1) =>
  Array.from({ length: n }, () => ({ weight, reps }));

const movement = (patch: Partial<MovementDraft> & Pick<MovementDraft, 'exercise'>): MovementDraft => ({
  key: 'm0',
  warmup: [],
  working: [],
  ...patch,
});

const sets = (kind: LiftingSet['kind'], weightKg: number, reps: number, n = 1): LiftingSet[] =>
  Array.from({ length: n }, () => ({ kind, weightKg, reps }));

const entry = (id: string, workouts: WorkoutSession[], timestamp = 1000): ActivityLogEntry => ({
  id,
  timestamp,
  steps: 0,
  workouts,
  energyKcal: 0,
  satietyDrainKcal: 0,
  energyDayApplied: '2026-08-26',
});

describe('movementSets / movementsToWorkouts', () => {
  it('parses a comma decimal ("72,5") the way the phone keypad types it', () => {
    const m = movement({ exercise: 'bench_press', working: rows('72,5', '5', 2) });
    expect(movementSets(m).map((s) => s.weightKg)).toEqual([72.5, 72.5]);
  });

  it('skips incomplete rows and keeps a 0 kg (empty bar) set', () => {
    const m = movement({
      exercise: 'squat',
      working: [
        { weight: '', reps: '5' },
        { weight: '100', reps: '' },
        { weight: '0', reps: '10' },
      ],
    });
    expect(movementSets(m)).toEqual([{ kind: 'working', weightKg: 0, reps: 10 }]);
  });

  it('bench + incline in one save yields two sessions of the same lift', () => {
    const out = movementsToWorkouts([
      movement({ key: 'm0', exercise: 'bench_press', working: rows('72.5', '5', 5) }),
      movement({
        key: 'm1',
        exercise: 'bench_press',
        variationId: 'bench_incline',
        working: rows('62.5', '5', 5),
      }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ type: 'bench_press' });
    expect(out[0].variationId).toBeUndefined();
    expect(out[1]).toMatchObject({ type: 'bench_press', variationId: 'bench_incline' });
    expect(out[1].sets).toHaveLength(5);
    expect(out[1].minutes).toBeGreaterThan(0);
  });

  it('orders sessions squat → bench → deadlift, keeping add order inside a lift', () => {
    const out = movementsToWorkouts([
      movement({ key: 'm0', exercise: 'deadlift', working: rows('120', '3') }),
      movement({ key: 'm1', exercise: 'squat', variationId: 'squat_paused', working: rows('90', '5') }),
      movement({ key: 'm2', exercise: 'squat', working: rows('110', '5') }),
    ]);
    expect(out.map((w) => [w.type, w.variationId])).toEqual([
      ['squat', 'squat_paused'],
      ['squat', undefined],
      ['deadlift', undefined],
    ]);
  });

  it('drops movements with no valid set', () => {
    expect(movementsToWorkouts([emptyMovement('squat', 'm0')])).toEqual([]);
  });

  it('a typed variation name wins over an id, is trimmed, and blank means standard', () => {
    const named = movementsToWorkouts([
      movement({
        exercise: 'bench_press',
        variationId: 'bench_incline',
        variationName: '  Spoto  ',
        working: rows('80', '5'),
      }),
    ]);
    expect(named[0].variationName).toBe('Spoto');
    expect(named[0].variationId).toBeUndefined();

    const blank = movementsToWorkouts([
      movement({ exercise: 'bench_press', variationName: '   ', working: rows('80', '5') }),
    ]);
    expect(blank[0].variationName).toBeUndefined();
    expect(blank[0].variationId).toBeUndefined();
  });

  it('keeps warm-up + working sets together in one session', () => {
    const out = movementsToWorkouts([
      movement({ exercise: 'squat', warmup: rows('60', '5'), working: rows('100', '5', 3) }),
    ]);
    expect(out[0].sets?.map((s) => s.kind)).toEqual(['warmup', 'working', 'working', 'working']);
  });
});

describe('movementsFromEntry', () => {
  it('round-trips workouts → movements → workouts without losing a set', () => {
    const original: WorkoutSession[] = [
      { type: 'squat', minutes: 20, sets: [...sets('warmup', 60, 5), ...sets('working', 100, 5, 3)] },
      {
        type: 'squat',
        minutes: 15,
        variationId: 'squat_paused',
        sets: sets('working', 90, 4, 3),
      },
      { type: 'deadlift', minutes: 10, variationName: 'Snatch grip', sets: sets('working', 120, 3, 2) },
    ];
    const back = movementsToWorkouts(movementsFromEntry(entry('a', original)));
    expect(back.map((w) => w.sets)).toEqual(original.map((w) => w.sets));
    expect(back.map((w) => [w.type, w.variationId, w.variationName])).toEqual([
      ['squat', undefined, undefined],
      ['squat', 'squat_paused', undefined],
      ['deadlift', undefined, 'Snatch grip'],
    ]);
  });

  it('a row logged before variations existed becomes a standard movement', () => {
    const m = movementsFromEntry(
      entry('a', [{ type: 'bench_press', minutes: 10, sets: sets('working', 90, 5, 2) }])
    );
    expect(m).toHaveLength(1);
    expect(m[0].variationId).toBeUndefined();
    expect(m[0].variationName).toBeUndefined();
    expect(m[0].working).toEqual([
      { weight: '90', reps: '5' },
      { weight: '90', reps: '5' },
    ]);
  });

  it('ignores bodybuilding and minutes-only workouts; empty → one empty squat', () => {
    const m = movementsFromEntry(
      entry('a', [
        { type: 'bodybuilding', minutes: 10, sets: sets('working', 20, 12), bbMet: 4 },
        { type: 'running', minutes: 30 },
      ])
    );
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ exercise: 'squat', working: [{ weight: '', reps: '' }] });
    expect(movementsFromEntry(null)).toHaveLength(1);
  });
});

describe('nextMovementKey', () => {
  it('returns the next free m<n>', () => {
    expect(nextMovementKey([])).toBe('m0');
    expect(nextMovementKey([movement({ key: 'm0', exercise: 'squat' }), movement({ key: 'm3', exercise: 'squat' })])).toBe('m4');
  });
});

describe('variationIdentity', () => {
  it('treats none and loadFactor-1 library ids as the same (standard)', () => {
    expect(variationIdentity({})).toBe('');
    expect(variationIdentity({ variationId: 'bench_touch_and_go' })).toBe('');
    expect(variationIdentity({ variationId: 'squat_standard' })).toBe('');
  });

  it('distinguishes library variations and matches free text case-insensitively', () => {
    expect(variationIdentity({ variationId: 'bench_incline' })).toBe('v:bench_incline');
    expect(variationIdentity({ variationName: 'Spoto' })).toBe(variationIdentity({ variationName: ' spoto ' }));
  });
});

describe('findPrevSessionForMovement', () => {
  const bench = (id: string, t: number, variation: Partial<WorkoutSession> = {}) =>
    entry(id, [{ type: 'bench_press', minutes: 10, sets: sets('working', 90, 5), ...variation }], t);
  const history = [
    bench('std-old', 1),
    bench('inc-old', 2, { variationId: 'bench_incline' }),
    bench('std-new', 3),
  ];

  it('finds the latest session of the same lift + variation', () => {
    const m = findPrevSessionForMovement(history, { exercise: 'bench_press', variationId: 'bench_incline' });
    expect(m?.entry.id).toBe('inc-old');
    const std = findPrevSessionForMovement(history, { exercise: 'bench_press' });
    expect(std?.entry.id).toBe('std-new');
  });

  it('a variation with no history of its own falls back to the latest standard session', () => {
    const m = findPrevSessionForMovement(history, { exercise: 'bench_press', variationId: 'bench_low_grip' });
    expect(m?.entry.id).toBe('std-new');
  });

  it('a standard movement never borrows a variation session', () => {
    const onlyIncline = [bench('inc', 1, { variationId: 'bench_incline' })];
    expect(findPrevSessionForMovement(onlyIncline, { exercise: 'bench_press' })).toBeNull();
  });

  it('skips the entry being edited and other lifts', () => {
    expect(findPrevSessionForMovement(history, { exercise: 'bench_press' }, 'std-new')?.entry.id).toBe('std-old');
    expect(findPrevSessionForMovement(history, { exercise: 'squat' })).toBeNull();
  });

  it('ignores bodybuilding sessions and sessions without sets', () => {
    const noise = [
      entry('a', [{ type: 'bench_press', minutes: 10 }], 5),
      entry('b', [{ type: 'bench_press', minutes: 10, sets: sets('working', 20, 12), bbMet: 4 }], 6),
    ];
    expect(findPrevSessionForMovement(noise, { exercise: 'bench_press' })).toBeNull();
  });
});

describe('variation choices', () => {
  it('selectableVariationIds excludes the standard-equivalent entries', () => {
    expect(selectableVariationIds('bench_press')).toEqual(['bench_paused', 'bench_low_grip', 'bench_incline']);
    expect(selectableVariationIds('squat')).toEqual(['squat_paused']);
  });

  it('suggestNextVariationId picks the first unused variation, else undefined', () => {
    const one = movement({ exercise: 'squat' });
    expect(suggestNextVariationId('squat', [one])).toBe('squat_paused');
    const both = [one, movement({ key: 'm1', exercise: 'squat', variationId: 'squat_paused' })];
    expect(suggestNextVariationId('squat', both)).toBeUndefined();
  });
});
