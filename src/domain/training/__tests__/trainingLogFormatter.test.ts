import {
  formatSetSequence,
  formatMovement,
  formatDayLine,
  trainingDaySignature,
  detectDayConflict,
  normalizeDecimalCommas,
  normalizeManualBody,
  abbreviationKeyOf,
  formatWeekHeading,
} from '../trainingLogFormatter';
import { translate } from '../../../i18n/translate';
import { weekdayLabel } from '../../../lib/dateUtils';
import { DEFAULT_TRAINING_LOG_FORMAT } from '../../../types/trainingLog';
import type { TrainingLogDayRecord, TrainingLogFormat } from '../../../types/trainingLog';
import type { ActivityLogEntry, LiftingSet, WorkoutSession } from '../../../types/energy';

const FMT: TrainingLogFormat = DEFAULT_TRAINING_LOG_FORMAT;
const fmt = (patch: Partial<TrainingLogFormat>): TrainingLogFormat => ({ ...FMT, ...patch });

// working(90, [1]) → one set; working(72.5, [5,5,5,5,5]) → five sets.
const working = (weightKg: number, reps: number[]): LiftingSet[] =>
  reps.map((r) => ({ kind: 'working', weightKg, reps: r }));
const warmup = (weightKg: number, reps: number): LiftingSet => ({ kind: 'warmup', weightKg, reps });
const same = (n: number, r: number) => Array<number>(n).fill(r);

const lift = (
  type: 'squat' | 'bench_press' | 'deadlift',
  sets: LiftingSet[],
  extra: Partial<WorkoutSession> = {}
): WorkoutSession => ({ type, minutes: 60, sets, ...extra });

const entry = (
  id: string,
  workouts: WorkoutSession[],
  over: Partial<ActivityLogEntry> = {}
): ActivityLogEntry => ({
  id,
  timestamp: 1_000,
  steps: 0,
  workouts,
  energyKcal: 0,
  satietyDrainKcal: 0,
  energyDayApplied: '2026-08-26',
  ...over,
});

const line = (entries: ActivityLogEntry[], format = FMT, language: 'vi' | 'en' | 'de' = 'vi') => {
  const { body } = formatDayLine({ date: '2026-08-26', entries, format, language });
  return body;
};

describe('formatSetSequence — grammar from the user’s real notes', () => {
  it('top single then even sets: D 120 5x4x100', () => {
    const s = [...working(120, [1]), ...working(100, same(5, 4))];
    expect(formatMovement(lift('deadlift', s), FMT, 'vi')).toBe('D 120 5x4x100');
  });

  it('keeps decimals with a dot: B 90 5x5x72.5', () => {
    const s = [...working(90, [1]), ...working(72.5, same(5, 5))];
    expect(formatMovement(lift('bench_press', s), FMT, 'vi')).toBe('B 90 5x5x72.5');
  });

  it('uses the variation abbreviation: iC 5x5x62.5', () => {
    const s = working(62.5, same(5, 5));
    expect(formatMovement(lift('bench_press', s, { variationId: 'bench_incline' }), FMT, 'vi')).toBe(
      'iC 5x5x62.5'
    );
  });

  it('joins movements of a day with a space: S 110 5x5x85 PD 5x6x85', () => {
    const squat = lift('squat', [...working(110, [1]), ...working(85, same(5, 5))]);
    const pd = lift('deadlift', working(85, same(5, 6)), { variationId: 'deadlift_paused' });
    expect(line([entry('a', [squat, pd])])).toBe('S 110 5x5x85 PD 5x6x85');
  });

  it('non-uniform reps use the parenthesised list: S 120 110x(4+5+5+4+8)', () => {
    const s = [...working(120, [1]), ...working(110, [4, 5, 5, 4, 8])];
    expect(formatMovement(lift('squat', s), FMT, 'vi')).toBe('S 120 110x(4+5+5+4+8)');
  });

  it('a top single is separated from what follows by a space, later clusters by +', () => {
    const s = [...working(130, [1]), ...working(115, same(4, 3)), ...working(100, [3])];
    expect(formatMovement(lift('squat', s), FMT, 'vi')).toBe('S 130 4x3x115+3x100');
  });

  it('D 140 6x4x110', () => {
    const s = [...working(140, [1]), ...working(110, same(6, 4))];
    expect(formatMovement(lift('deadlift', s), FMT, 'vi')).toBe('D 140 6x4x110');
  });

  it('last set with extra reps: B 95 6x4(+3)x75', () => {
    const s = [...working(95, [1]), ...working(75, [4, 4, 4, 4, 4, 7])];
    expect(formatMovement(lift('bench_press', s), FMT, 'vi')).toBe('B 95 6x4(+3)x75');
  });

  it('consecutive singles join with +, then a space before the volume cluster', () => {
    const s = [
      ...working(90, [1]),
      ...working(97.5, [1]),
      ...working(100, [1]),
      ...working(90, [2, 2, 2, 2, 5]),
    ];
    expect(formatMovement(lift('bench_press', s), FMT, 'vi')).toBe('B 90+97.5+100 5x2(+3)x90');
  });

  it('showWarmups prepends the ramp as reps x weight joined with +', () => {
    const s = [
      warmup(20, 8),
      warmup(60, 6),
      warmup(80, 3),
      ...working(90, [1]),
      ...working(97.5, [1]),
      ...working(100, [1]),
      ...working(90, [2, 2, 2, 2, 5]),
    ];
    expect(formatMovement(lift('bench_press', s), fmt({ showWarmups: true }), 'vi')).toBe(
      'B 8x20+6x60+3x80 90+97.5+100 5x2(+3)x90'
    );
    // Off by default: the ramp is hidden.
    expect(formatMovement(lift('bench_press', s), FMT, 'vi')).toBe('B 90+97.5+100 5x2(+3)x90');
  });

  it('a last set with FEWER reps is listed, not abbreviated', () => {
    expect(formatSetSequence(working(80, [5, 5, 5, 5, 3]), FMT, 'vi')).toBe('80x(5+5+5+5+3)');
  });

  it('two sets where the last has extra reps: 2x5(+3)x100', () => {
    expect(formatSetSequence(working(100, [5, 8]), FMT, 'vi')).toBe('2x5(+3)x100');
  });

  it('does not merge non-adjacent runs at the same weight', () => {
    const s = [...working(100, [5]), ...working(105, [3]), ...working(100, [5])];
    expect(formatSetSequence(s, FMT, 'vi')).toBe('5x100+3x105+5x100');
  });

  it('a warm-up-only movement prints the ramp even with showWarmups off', () => {
    expect(formatSetSequence([warmup(60, 5), warmup(80, 3)], FMT, 'vi')).toBe('5x60+3x80');
  });

  it('ignores zero-rep sets', () => {
    expect(formatSetSequence([...working(100, [5]), ...working(110, [0])], FMT, 'vi')).toBe('5x100');
  });

  it("decimal 'dot' is the default in every language; 'locale' follows the language", () => {
    const sets = working(112.5, same(4, 3));
    expect(formatSetSequence(sets, FMT, 'vi')).toBe('4x3x112.5');
    expect(formatSetSequence(sets, FMT, 'de')).toBe('4x3x112.5');
    expect(formatSetSequence(sets, fmt({ decimal: 'locale' }), 'vi')).toBe('4x3x112,5');
    expect(formatSetSequence(sets, fmt({ decimal: 'locale' }), 'de')).toBe('4x3x112,5');
    expect(formatSetSequence(sets, fmt({ decimal: 'locale' }), 'en')).toBe('4x3x112.5');
  });

  it('showUnit adds kg after each weight', () => {
    const s = [...working(90, [1]), ...working(72.5, same(5, 5))];
    expect(formatSetSequence(s, fmt({ showUnit: true }), 'vi')).toBe('90kg 5x5x72.5kg');
  });

  it('never prints float noise', () => {
    expect(formatSetSequence(working(72.49999999, [5]), FMT, 'vi')).toBe('5x72.5');
  });
});

describe('formatMovement — labels and non-set sessions', () => {
  const inclineSets = working(62.5, same(5, 5));

  it("a user override wins over the default abbreviation (var: key)", () => {
    const session = lift('bench_press', inclineSets, { variationId: 'bench_incline' });
    expect(formatMovement(session, fmt({ abbreviations: { 'var:bench_incline': 'IC' } }), 'vi')).toBe(
      'IC 5x5x62.5'
    );
  });

  it('an empty override string means "no override"', () => {
    const session = lift('bench_press', inclineSets, { variationId: 'bench_incline' });
    expect(formatMovement(session, fmt({ abbreviations: { 'var:bench_incline': '  ' } }), 'vi')).toBe(
      'iC 5x5x62.5'
    );
  });

  it('a loadFactor-1 variation shares the plain lift key', () => {
    const session = lift('bench_press', inclineSets, { variationId: 'bench_touch_and_go' });
    expect(abbreviationKeyOf(session)).toBe('lift:bench_press');
    expect(formatMovement(session, fmt({ abbreviations: { 'lift:bench_press': 'BP' } }), 'vi')).toBe(
      'BP 5x5x62.5'
    );
  });

  it('a free-text variation prints its own name until the user gives it an abbreviation', () => {
    const session = lift('bench_press', inclineSets, { variationName: 'Spoto' });
    expect(abbreviationKeyOf(session)).toBe('cvar:Spoto');
    expect(formatMovement(session, FMT, 'vi')).toBe('Spoto 5x5x62.5');
    expect(formatMovement(session, fmt({ abbreviations: { 'cvar:Spoto': 'Sp' } }), 'vi')).toBe(
      'Sp 5x5x62.5'
    );
  });

  it("labelStyle 'full' uses full names and ' · ' between movements", () => {
    const a = lift('bench_press', inclineSets, { variationId: 'bench_incline' });
    const b = lift('squat', working(100, [5]));
    const out = line([entry('a', [a, b])], fmt({ labelStyle: 'full' }));
    expect(out).toContain(translate('vi', 'blockVariations.bench_incline.label'));
    expect(out).toContain(translate('vi', 'activities.squat'));
    expect(out).toContain(' · ');
  });

  it('a lift logged before sets existed shows minutes', () => {
    const old: WorkoutSession = { type: 'squat', minutes: 45 };
    expect(formatMovement(old, FMT, 'vi')).toBe('S 45 phút');
    expect(formatMovement(old, FMT, 'en')).toBe('S 45 min');
    expect(formatMovement(old, FMT, 'de')).toBe('S 45 Min.');
  });

  it('a custom activity shows its own name + minutes', () => {
    const custom: WorkoutSession = { type: 'custom', minutes: 20, customName: 'Kéo xà', customMet: 5 };
    expect(formatMovement(custom, FMT, 'vi')).toBe('Kéo xà 20 phút');
  });

  it('a MET activity shows its translated label + minutes', () => {
    const run: WorkoutSession = { type: 'running', minutes: 30 };
    expect(formatMovement(run, FMT, 'vi')).toBe(`${translate('vi', 'activities.running')} 30 phút`);
  });

  it('a bodybuilding session is recognised by bbMet, not by sets', () => {
    const bb: WorkoutSession = {
      type: 'bodybuilding',
      minutes: 30,
      sets: working(20, same(3, 12)),
      bbMet: 4,
      bbExerciseId: 'bbx_1',
      bbName: 'Cable fly',
    };
    expect(abbreviationKeyOf(bb)).toBe('bb:bbx_1');
    expect(formatMovement(bb, FMT, 'vi')).toBe('Cable fly 3x12x20');
    expect(formatMovement(bb, fmt({ abbreviations: { 'bb:bbx_1': 'CF' } }), 'vi')).toBe('CF 3x12x20');
  });
});

describe('formatDayLine', () => {
  const squat = lift('squat', [...working(130, [1]), ...working(115, same(4, 3)), ...working(100, [3])]);

  it('prefixes date, colon and the body weight', () => {
    const out = formatDayLine({
      date: '2026-08-26',
      entries: [entry('a', [squat])],
      bodyWeightKg: 77.7,
      format: FMT,
      language: 'vi',
    });
    expect(out.prefix).toBe('26.08(77.7kg):');
    expect(out.body).toBe('S 130 4x3x115+3x100');
  });

  it('omits the weight when the option is off or there is no reading', () => {
    const base = { date: '2026-08-26', entries: [entry('a', [squat])], language: 'vi' as const };
    expect(formatDayLine({ ...base, bodyWeightKg: 77.7, format: fmt({ showBodyWeight: false }) }).prefix).toBe(
      '26.08:'
    );
    expect(formatDayLine({ ...base, format: FMT }).prefix).toBe('26.08:');
  });

  it('the date order follows the language (en is month/day)', () => {
    const p = formatDayLine({ date: '2026-08-26', entries: [], format: FMT, language: 'en' }).prefix;
    expect(p).toBe('08/26:');
  });

  it('showWeekday puts the localized short weekday first (2026-08-26 is a Wednesday)', () => {
    const p = formatDayLine({
      date: '2026-08-26',
      entries: [],
      format: fmt({ showWeekday: true }),
      language: 'vi',
    }).prefix;
    expect(p).toBe(`${weekdayLabel(3, 'vi', 'short')} 26.08:`);
  });

  it('orders entries by when they happened, not by array order', () => {
    const late = entry('late', [lift('squat', working(100, [5]))], { timestamp: 2_000 });
    const early = entry('early', [lift('deadlift', working(120, [3]))], { timestamp: 1_000 });
    expect(line([late, early])).toBe('D 3x120 S 5x100');
  });

  it('uses startAt over timestamp for ordering', () => {
    const a = entry('a', [lift('squat', working(100, [5]))], { timestamp: 1_000, startAt: 9_000 });
    const b = entry('b', [lift('deadlift', working(120, [3]))], { timestamp: 5_000 });
    expect(line([a, b])).toBe('D 3x120 S 5x100');
  });

  it('skips steps-only entries', () => {
    const steps = entry('s', [], { steps: 8000 });
    expect(line([steps])).toBe('');
    expect(line([steps, entry('a', [squat])])).toBe('S 130 4x3x115+3x100');
  });

  it('showKcal appends the day total of entries that have workouts', () => {
    const a = entry('a', [squat], { energyKcal: 100.4 });
    const b = entry('b', [lift('deadlift', working(120, [3]))], { energyKcal: 145 });
    const steps = entry('s', [], { steps: 5000, energyKcal: 999 });
    expect(line([a, b, steps], fmt({ showKcal: true }))).toMatch(/ · 245 kcal$/);
  });
});

describe('trainingDaySignature', () => {
  const a = entry('a', [lift('squat', working(100, same(5, 5)))], { timestamp: 1 });
  const b = entry('b', [lift('deadlift', working(120, [3]))], { timestamp: 2 });

  it('is stable when the input order changes', () => {
    expect(trainingDaySignature([a, b])).toBe(trainingDaySignature([b, a]));
  });

  it('changes when a single rep changes', () => {
    const edited = entry('a', [lift('squat', working(100, [5, 5, 5, 5, 6]))], { timestamp: 1 });
    expect(trainingDaySignature([edited, b])).not.toBe(trainingDaySignature([a, b]));
  });

  it('ignores the entry id (an edit re-logs under a new id, same content)', () => {
    const relogged = { ...a, id: 'zzz' };
    expect(trainingDaySignature([relogged, b])).toBe(trainingDaySignature([a, b]));
  });

  it('ignores steps-only entries', () => {
    const steps = entry('s', [], { steps: 4000, timestamp: 3 });
    expect(trainingDaySignature([a, b, steps])).toBe(trainingDaySignature([a, b]));
  });

  it('changes when an entry is added or removed', () => {
    expect(trainingDaySignature([a])).not.toBe(trainingDaySignature([a, b]));
  });
});

describe('detectDayConflict', () => {
  const e = entry('a', [lift('squat', working(100, [5]))]);
  const rec = (patch: Partial<TrainingLogDayRecord>): TrainingLogDayRecord => ({
    date: '2026-08-26',
    overrideText: 'S 100 5',
    note: null,
    sourceSignature: null,
    updatedAt: 1,
    ...patch,
  });

  it('none: no record, or a note-only record (no override)', () => {
    expect(detectDayConflict({ record: null, entries: [e] })).toBe('none');
    expect(detectDayConflict({ record: rec({ overrideText: null, note: 'x' }), entries: [e] })).toBe('none');
  });

  it('none: an edited line whose entries have not changed', () => {
    const record = rec({ sourceSignature: trainingDaySignature([e]) });
    expect(detectDayConflict({ record, entries: [e] })).toBe('none');
  });

  it('sourceChanged: an edited line whose entries changed since', () => {
    const record = rec({ sourceSignature: trainingDaySignature([e]) });
    const changed = entry('a', [lift('squat', working(100, [6]))]);
    expect(detectDayConflict({ record, entries: [changed] })).toBe('sourceChanged');
  });

  it('xaAddedToManual: a hand-written line and Xả now has an entry for the day', () => {
    expect(detectDayConflict({ record: rec({}), entries: [e] })).toBe('xaAddedToManual');
  });

  it('none: a hand-written line with no Xả entry (the normal case)', () => {
    expect(detectDayConflict({ record: rec({}), entries: [] })).toBe('none');
  });

  it('sourceGone: an edited line whose entries were all removed', () => {
    const record = rec({ sourceSignature: trainingDaySignature([e]) });
    expect(detectDayConflict({ record, entries: [] })).toBe('sourceGone');
  });

  it('a steps-only entry does not count as Xả content', () => {
    const steps = entry('s', [], { steps: 4000 });
    expect(detectDayConflict({ record: rec({}), entries: [steps] })).toBe('none');
  });
});

describe('normalizeDecimalCommas / normalizeManualBody', () => {
  it('turns a comma between digits into a dot', () => {
    expect(normalizeDecimalCommas('72,5')).toBe('72.5');
    expect(normalizeDecimalCommas('5x5x72,5+3x100')).toBe('5x5x72.5+3x100');
  });

  it('leaves other commas alone', () => {
    expect(normalizeDecimalCommas('B 90, S 100')).toBe('B 90, S 100');
    expect(normalizeDecimalCommas('Bench, sau đó squat')).toBe('Bench, sau đó squat');
  });

  it('known limit: digit,digit,digit keeps its second comma', () => {
    expect(normalizeDecimalCommas('1,2,3')).toBe('1.2,3');
  });

  it("only rewrites when the user displays dots (decimal: 'dot')", () => {
    expect(normalizeManualBody('S 72,5', FMT)).toBe('S 72.5');
    expect(normalizeManualBody('S 72,5', fmt({ decimal: 'locale' }))).toBe('S 72,5');
  });
});

describe('formatWeekHeading — which block/week, its dates, its weight', () => {
  const week = { weekStart: '2026-09-07', weekEnd: '2026-09-13', weekNumber: 1, sessions: 3, dates: [] };
  const block = { kind: 'block' as const, blockNumber: 2 };

  it('block week: "B2W1: 07.09–13.09 76.3kg"', () => {
    expect(formatWeekHeading(week, block, 76.3, FMT, 'vi')).toBe('B2W1: 07.09–13.09 76.3kg');
    expect(formatWeekHeading(week, block, null, FMT, 'vi')).toBe('B2W1: 07.09–13.09');
    expect(formatWeekHeading(week, block, 76.3, fmt({ showBodyWeight: false }), 'vi')).toBe('B2W1: 07.09–13.09');
  });

  it('deload week and a free week', () => {
    expect(formatWeekHeading({ ...week, isDeload: true }, block, null, FMT, 'vi')).toBe('B2 DELOAD: 07.09–13.09');
    expect(formatWeekHeading(week, { kind: 'free' }, 76.3, FMT, 'vi')).toBe('07.09–13.09 76.3kg');
    expect(formatWeekHeading(week, block, null, FMT, 'en')).toBe('B2W1: 09/07–09/13');
  });
});
