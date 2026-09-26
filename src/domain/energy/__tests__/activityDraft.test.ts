import { blankDraft, draftFromPrefill, isDraftBlank, isDraftFresh, minutesBetween, withTimes, DRAFT_TTL_MS } from '../activityDraft';

const TODAY = '2026-09-26';

describe('activity draft', () => {
  it('is fresh for five minutes, then expires', () => {
    expect(isDraftFresh(1_000, 1_000 + DRAFT_TTL_MS)).toBe(true);
    expect(isDraftFresh(1_000, 1_001 + DRAFT_TTL_MS)).toBe(false);
  });

  it('treats an untouched form as blank', () => {
    expect(isDraftBlank(blankDraft(TODAY), TODAY)).toBe(true);
    expect(isDraftBlank({ ...blankDraft(TODAY), steps: '4000' }, TODAY)).toBe(false);
    expect(isDraftBlank(blankDraft('2026-09-20'), TODAY)).toBe(false);
  });

  it('measures a time range, including across midnight', () => {
    expect(minutesBetween('06:30', '07:15')).toBe(45);
    expect(minutesBetween('23:30', '00:15')).toBe(45);
    expect(minutesBetween('7:00', '7:00')).toBeNull();
    expect(minutesBetween('abc', '07:00')).toBeNull();
  });

  it('fills minutes from the range, but never over a hand-typed value', () => {
    const auto = withTimes(blankDraft(TODAY), '06:30', '07:10');
    expect(auto).toMatchObject({ minutes: '40', minutesAuto: true });
    expect(withTimes(auto, '06:30', '07:30').minutes).toBe('60');
    const typed = { ...blankDraft(TODAY), minutes: '25' };
    expect(withTimes(typed, '06:30', '07:30').minutes).toBe('25');
  });
});

describe('draftFromPrefill', () => {
  const categoryOf = (t: string) => (t === 'running' ? 'cardio' : t === 'yoga' ? 'other' : null);

  it('prefills a built-in activity with its group, minutes and times', () => {
    const d = draftFromPrefill(blankDraft(TODAY), { type: 'yoga', minutes: 30, startTime: '06:30', endTime: '07:00' }, [], categoryOf);
    expect(d).toMatchObject({ category: 'other', activity: 'yoga', customId: null, minutes: '30', startTime: '06:30', prefilled: true });
  });

  it('finds a custom activity by name, or gives up if it was deleted', () => {
    const customs = [{ id: 'c1', nameVi: 'Pickleball', category: 'sports' }];
    const p = { type: 'custom' as const, customName: 'Pickleball', minutes: 60 };
    expect(draftFromPrefill(blankDraft(TODAY), p, customs, categoryOf)).toMatchObject({ customId: 'c1', category: 'sports' });
    expect(draftFromPrefill(blankDraft(TODAY), p, [], categoryOf)).toBeNull();
  });
});
