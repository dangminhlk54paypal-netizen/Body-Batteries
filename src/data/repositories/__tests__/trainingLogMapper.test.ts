import {
  cleanText,
  countSessionsByDay,
  isBlank,
  isEmptyDayRecord,
  isEmptyWeekRecord,
  rowToDayRecord,
  rowToWeekRecord,
} from '../trainingLogMapper';

describe('rowToDayRecord / rowToWeekRecord', () => {
  it('maps every column', () => {
    expect(
      rowToDayRecord({
        date: '2026-08-26',
        override_text: 'S 130 4x3x115',
        note: 'nặng',
        source_signature: 'abc',
        updated_at: 5,
      })
    ).toEqual({
      date: '2026-08-26',
      overrideText: 'S 130 4x3x115',
      note: 'nặng',
      sourceSignature: 'abc',
      updatedAt: 5,
    });
    expect(rowToWeekRecord({ week_start: '2026-08-24', note: 'nghỉ lễ', updated_at: 9 })).toEqual({
      weekStart: '2026-08-24',
      note: 'nghỉ lễ',
      updatedAt: 9,
    });
  });

  it('keeps NULL columns as null (NULL signature = hand-written line)', () => {
    const rec = rowToDayRecord({
      date: '2026-08-26',
      override_text: 'S 100 5',
      note: null,
      source_signature: null,
      updated_at: 1,
    });
    expect(rec.note).toBeNull();
    expect(rec.sourceSignature).toBeNull();
  });
});

describe('emptiness rules', () => {
  it('isBlank treats null and whitespace as empty', () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank('   \n ')).toBe(true);
    expect(isBlank('x')).toBe(false);
  });

  it('a day with neither a line nor a note is empty (so the row is deleted)', () => {
    expect(isEmptyDayRecord({ overrideText: null, note: null })).toBe(true);
    expect(isEmptyDayRecord({ overrideText: ' ', note: '' })).toBe(true);
    expect(isEmptyDayRecord({ overrideText: 'S 100 5', note: null })).toBe(false);
    expect(isEmptyDayRecord({ overrideText: null, note: 'ngủ ít' })).toBe(false);
  });

  it('a week with a blank note is empty', () => {
    expect(isEmptyWeekRecord({ note: null })).toBe(true);
    expect(isEmptyWeekRecord({ note: '  ' })).toBe(true);
    expect(isEmptyWeekRecord({ note: 'x' })).toBe(false);
  });

  it('cleanText trims and turns blank into null', () => {
    expect(cleanText('  a b ')).toBe('a b');
    expect(cleanText('   ')).toBeNull();
    expect(cleanText(null)).toBeNull();
  });
});

describe('countSessionsByDay', () => {
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

  it('groups timestamps by local calendar day, ascending, with counts', () => {
    const out = countSessionsByDay([at(2026, 8, 26), at(2026, 8, 24, 7), at(2026, 8, 26, 20)]);
    expect(out).toEqual([
      { date: '2026-08-24', sessions: 1 },
      { date: '2026-08-26', sessions: 2 },
    ]);
  });

  it('a 00:30 session belongs to that calendar day (History rule, not the 6am energy day)', () => {
    expect(countSessionsByDay([new Date(2026, 7, 27, 0, 30).getTime()])).toEqual([
      { date: '2026-08-27', sessions: 1 },
    ]);
  });

  it('returns [] for no timestamps', () => {
    expect(countSessionsByDay([])).toEqual([]);
  });
});
