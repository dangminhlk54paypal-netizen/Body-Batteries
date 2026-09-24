import { parseSetNotation } from '../setNotation';
import { formatSetSequence } from '../trainingLogFormatter';
import { DEFAULT_TRAINING_LOG_FORMAT } from '../../../types/trainingLog';
import type { LiftingSet } from '../../../types/energy';

const w = (weightKg: number, reps: number[]): LiftingSet[] => reps.map((r) => ({ kind: 'working', weightKg, reps: r }));
const parse = (text: string) => {
  const r = parseSetNotation(text);
  if (!r.ok) throw new Error(`did not parse: ${text} (bad: ${r.badToken})`);
  return r.sets;
};

describe('parseSetNotation — each form', () => {
  it('reads the forms the log writes', () => {
    expect(parse('90')).toEqual(w(90, [1]));
    expect(parse('3x100')).toEqual(w(100, [3]));
    expect(parse('5x5x72.5')).toEqual(w(72.5, [5, 5, 5, 5, 5]));
    expect(parse('6x4(+3)x75')).toEqual(w(75, [4, 4, 4, 4, 4, 7]));
    expect(parse('110x(4+5+5+4+8)')).toEqual(w(110, [4, 5, 5, 4, 8]));
  });

  it('a two-number set reads the smaller number as reps, whichever order it is written in', () => {
    expect(parse('110x1')).toEqual(w(110, [1]));
    expect(parse('95x5')).toEqual(w(95, [5]));
    expect(parse('8x20')).toEqual(w(20, [8]));
    expect(parse('5x5')).toEqual(w(5, [5])); // tie: reps first — the preview shows "5 kg"
    expect(parseSetNotation('2.5x3').ok).toBe(false); // reps must be whole
  });

  it('also reads the spreadsheet "@" form and the grouped "(4x2+5)x90" form', () => {
    expect(parse('5x5@95')).toEqual(w(95, [5, 5, 5, 5, 5]));
    expect(parse('(4x2+5)x90')).toEqual(w(90, [2, 2, 2, 2, 5]));
  });

  it('reads whole lines from the user’s notes and spreadsheet', () => {
    expect(parse('110x1 - 5x5@95')).toEqual([...w(110, [1]), ...w(95, [5, 5, 5, 5, 5])]);
    expect(parse('130 4x3x115+3x100')).toEqual([...w(130, [1]), ...w(115, [3, 3, 3, 3]), ...w(100, [3])]);
    expect(parse('8x20+6x60+3x80 90+97.5+100')).toEqual([
      ...w(20, [8]),
      ...w(60, [6]),
      ...w(80, [3]),
      ...w(90, [1]),
      ...w(97.5, [1]),
      ...w(100, [1]),
    ]);
  });

  it('accepts a decimal comma, ×/X/*, "kg" and extra spaces', () => {
    expect(parse('5x5x72,5')).toEqual(w(72.5, [5, 5, 5, 5, 5]));
    expect(parse('3×5×100')).toEqual(w(100, [5, 5, 5]));
    expect(parse('3X5X100kg')).toEqual(w(100, [5, 5, 5]));
    expect(parse('  2*3*100 kg  ')).toEqual(w(100, [3, 3]));
  });
});

describe('parseSetNotation — rejects', () => {
  it('nothing typed', () => {
    expect(parseSetNotation('   ')).toEqual({ ok: false, badToken: '' });
  });

  it('names the token it could not read', () => {
    expect(parseSetNotation('5x5x95 abc')).toEqual({ ok: false, badToken: 'abc' });
    expect(parseSetNotation('5x5x')).toEqual({ ok: false, badToken: '5x5x' });
  });

  it('implausible numbers (0 reps, absurd weight, too many sets)', () => {
    expect(parseSetNotation('0x100').ok).toBe(false);
    expect(parseSetNotation('3x5x5000').ok).toBe(false);
    expect(parseSetNotation('50x5x100').ok).toBe(false);
  });
});

describe('round trip with formatSetSequence', () => {
  const lines = [
    '120 5x4x100',
    '90 5x5x72.5',
    '5x5x62.5',
    '120 110x(4+5+5+4+8)',
    '130 4x3x115+3x100',
    '140 6x4x110',
    '95 6x4(+3)x75',
    '90+97.5+100 5x2(+3)x90',
    '80x(5+5+5+5+3)',
    '5x100+3x105+5x100',
  ];
  it.each(lines)('%s', (line) => {
    expect(formatSetSequence(parse(line), DEFAULT_TRAINING_LOG_FORMAT, 'vi')).toBe(line);
  });
});
