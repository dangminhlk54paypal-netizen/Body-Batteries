import { buildLabelLookup, parseDayBody, parseSetChain, stripKcalSuffix } from '../trainingLogParser';
import { formatSetSequence } from '../trainingLogFormatter';
import { DEFAULT_TRAINING_LOG_FORMAT } from '../../../types/trainingLog';
import type { TrainingLogFormat } from '../../../types/trainingLog';
import type { LiftingSet, WorkoutSession } from '../../../types/energy';

const FMT: TrainingLogFormat = DEFAULT_TRAINING_LOG_FORMAT;
const fmt = (patch: Partial<TrainingLogFormat>): TrainingLogFormat => ({ ...FMT, ...patch });
const working = (weightKg: number, reps: number[]): LiftingSet[] =>
  reps.map((r) => ({ kind: 'working', weightKg, reps: r }));
const same = (n: number, r: number) => Array<number>(n).fill(r);
const parse = (body: string, format = FMT, known: WorkoutSession[] = []) =>
  parseDayBody(body, { format, language: 'vi', known });

describe('parseSetChain — the notation read back into sets', () => {
  // Every golden row of the formatter (plan §4.3.6) must round-trip.
  const golden: LiftingSet[][] = [
    [...working(120, [1]), ...working(100, same(5, 4))],
    [...working(90, [1]), ...working(72.5, same(5, 5))],
    [...working(120, [1]), ...working(110, [4, 5, 5, 4, 8])],
    [...working(130, [1]), ...working(115, same(4, 3)), ...working(100, [3])],
    [...working(95, [1]), ...working(75, [4, 4, 4, 4, 4, 7])],
    [...working(90, [1]), ...working(97.5, [1]), ...working(100, [1]), ...working(90, [2, 2, 2, 2, 5])],
    working(80, [5, 5, 5, 5, 3]),
    working(100, [5, 8]),
    [...working(100, [5]), ...working(105, [3]), ...working(100, [5])],
  ];
  it.each(golden.map((sets, i) => [i, sets] as const))('golden row %i round-trips', (_i, sets) => {
    const text = formatSetSequence(sets, FMT, 'vi');
    const parsed = parse(`S ${text}`);
    expect(parsed.unparsed).toEqual([]);
    expect(parsed.movements).toHaveLength(1);
    expect(parsed.movements[0].sets).toEqual(sets);
  });

  it('accepts a decimal comma and a glued kg unit', () => {
    expect(parseSetChain('5x5x72,5', 'vi')?.sets).toEqual(same(5, 5).map((r) => ({ reps: r, weightKg: 72.5 })));
    expect(parseSetChain('4x3x112.5kg', 'vi')?.sets).toHaveLength(4);
    expect(parseSetChain('3×100', 'vi')?.sets).toEqual([{ reps: 3, weightKg: 100 }]);
  });

  it('rejects words and nonsense', () => {
    expect(parseSetChain('PS', 'vi')).toBeNull();
    expect(parseSetChain('4x3x100(+8)', 'vi')).toBeNull(); // not this grammar
    expect(parseSetChain('0x5x100', 'vi')).toBeNull();
    expect(parseSetChain('5x500x100', 'vi')).toBeNull(); // 500 reps
  });
});

describe('parseDayBody — labels, movements, annotations', () => {
  it('reads a whole day with variations: S 110 5x5x85 PD 5x6x85', () => {
    const { movements, unparsed } = parse('S 110 5x5x85 PD 5x6x85');
    expect(unparsed).toEqual([]);
    expect(movements.map((m) => m.identity)).toEqual([
      { exercise: 'squat' },
      { exercise: 'deadlift', variationId: 'deadlift_paused' },
    ]);
    expect(movements[1].sets).toEqual(working(85, same(5, 6)));
  });

  it('labels match case-insensitively (the old Notes wrote "pS")', () => {
    expect(parse('pS 5x4x80').movements[0].identity).toEqual({ exercise: 'squat', variationId: 'squat_paused' });
    expect(parse('iC 5x5x62.5').movements[0].identity).toEqual({ exercise: 'bench_press', variationId: 'bench_incline' });
  });

  it('understands the user’s own abbreviation and full names', () => {
    const own = fmt({ abbreviations: { 'var:bench_incline': 'INC' } });
    expect(parse('INC 4x6x60', own).movements[0].identity?.variationId).toBe('bench_incline');
    const full = parse('Squat 110 5x5x85 · Deadlift 120', fmt({ labelStyle: 'full' }));
    expect(full.movements.map((m) => m.identity?.exercise)).toEqual(['squat', 'deadlift']);
  });

  it('a free-text variation resolves through the day’s own sessions', () => {
    const known: WorkoutSession[] = [
      { type: 'squat', minutes: 20, variationName: 'Box squat', sets: working(100, [5]) },
    ];
    const m = parse('Box squat 5x100', FMT, known).movements[0];
    expect(m.identity).toEqual({ exercise: 'squat', variationName: 'Box squat' });
  });

  it('sets aside annotations: failed attempts, RPE, struck-through weights', () => {
    const r = parse('B 90 (95 ❌)5x5x75 D 140 (rpe9.2) 6x4x110 B 97.5 +1̶0̶2̶.̶5̶❌+ 100');
    expect(r.annotations).toEqual(['(95 ❌)', '(rpe9.2)', '+1̶0̶2̶.̶5̶❌+']);
    expect(r.unparsed).toEqual([]);
    expect(r.movements[0].sets).toEqual([...working(90, [1]), ...working(75, same(5, 5))]);
    expect(r.movements[2].sets).toEqual([...working(97.5, [1]), ...working(100, [1])]);
  });

  it('reports what it cannot read instead of guessing', () => {
    expect(parse('5x5x80').unparsed).toEqual(['5x5x80']); // sets with no lift
    expect(parse('S').unparsed).toEqual(['S']); // a lift with no sets
    const unknown = parse('Chạy bộ 30');
    expect(unknown.movements[0].identity).toBeNull();
  });

  it('ignores the kcal suffix of showKcal', () => {
    expect(stripKcalSuffix('S 100 · 312 kcal', 'vi')).toBe('S 100');
    expect(parse('S 100 · 312 kcal').movements).toHaveLength(1);
  });

  it('the lookup maps a loadFactor-1 variation to the standard lift', () => {
    const lookup = buildLabelLookup(FMT, 'vi');
    expect(lookup.get('b')).toEqual({ exercise: 'bench_press' });
  });
});

describe('parseDayBody — the prime in front of the volume', () => {
  const warm = (weightKg: number, reps: number): LiftingSet => ({ kind: 'warmup', weightKg, reps });

  it('reads the user’s own ways of writing it as a warm-up, then the working sets', () => {
    const [b, ic] = parse('B 95+ 4x6x72.5  iC 3x6x60').movements;
    expect(b.sets).toEqual([warm(95, 1), ...working(72.5, same(4, 6))]);
    expect(ic.sets).toEqual(working(60, same(3, 6)));
    const [s, pd] = parse('S 135 + 4x6x100  PD 140 + 2x3x100+3x105').movements;
    expect(s.sets).toEqual([warm(135, 1), ...working(100, same(4, 6))]);
    expect(pd.sets).toEqual([warm(140, 1), ...working(100, same(2, 3)), ...working(105, [3])]);
  });

  it('round-trips the formatter’s own prime line', () => {
    const sets = [warm(60, 5), warm(100, 3), ...working(130, [1]), ...working(115, same(4, 3))];
    const text = formatSetSequence(sets, FMT, 'vi');
    expect(text).toBe('3x100 + 130 4x3x115');
    expect(parse(`S ${text}`).movements[0].sets).toEqual(sets.slice(1)); // the prime + the working sets
  });

  it('a "+" between two movements stays a separator, a trailing "+" is not a prime', () => {
    const p = parse('S 100 + B 80');
    expect(p.movements.map((m) => m.sets)).toEqual([working(100, [1]), working(80, [1])]);
    expect(parse('S 100+').movements[0].sets).toEqual(working(100, [1]));
  });
});
