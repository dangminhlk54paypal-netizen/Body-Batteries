import {
  dateForWeekday,
  hasLegacySuggestions,
  pauseAtWeek,
  referenceOf,
  refreshSuggestions,
  removeBreak,
  setDayAccessories,
  setDaySkipped,
  setVariationSets,
  setWeekDates,
  setWeekSkipped,
} from '../blockPlanEdits';
import { generateBlockPlan } from '../blockEngine';
import type { LiftingSet, UserProfile } from '../../../types/energy';
import type { GeneratedBlockPlan, TrainingBlockConfig } from '../../../types/powerliftingBlock';

const profile: UserProfile = { weightKg: 80, heightCm: 175, age: 28, sex: 'male', occupation: 'sedentary' };

const config: TrainingBlockConfig = {
  id: 'b',
  createdAt: 1,
  weekStartDate: '2026-09-07', // Monday
  progressiveWeeks: 3,
  hasDeload: true,
  focus: 'volume',
  schedule: [
    {
      dayOfWeek: 1, // Monday
      variations: [
        { exercise: 'bench_press', variationId: 'bench_touch_and_go', role: 'main' },
        { exercise: 'bench_press', variationId: 'bench_incline', role: 'secondary' },
      ],
      accessories: [{ customName: 'Row', sets: 3, reps: '10' }],
    },
    {
      dayOfWeek: 4, // Thursday
      variations: [{ exercise: 'squat', variationId: 'squat_standard', role: 'main' }],
      accessories: [],
    },
  ],
  oneRepMax: { squat: 200, bench_press: 120, deadlift: 250 },
  isBeginnerEstimated: { squat: false, bench_press: false, deadlift: false },
  bodyWeightKg: 80,
  deficitModeEnabled: false,
};

const plan = () => generateBlockPlan(config, profile);
const at = { weekIndex: 1, dayIndex: 0, variationIndex: 0 };
const sets = (w: number, reps: number[]): LiftingSet[] => reps.map((r) => ({ kind: 'working', weightKg: w, reps: r }));

describe('setVariationSets', () => {
  it('stores the user’s sets, keeps the app suggestion as reference, and recomputes kcal + totals', () => {
    const before = plan();
    const suggested = before.weeks[1].days[0].variations[0];
    const mine = [...sets(110, [1]), ...sets(95, [5, 5, 5, 5, 5])];
    const after = setVariationSets(before, at, mine, 175);
    const v = after.weeks[1].days[0].variations[0];

    expect(v.sets).toEqual(mine);
    expect(v.userEdited).toBe(true);
    expect(v.reference?.sets).toEqual(suggested.sets);
    expect(v.reference?.method).toBe('rpe');
    expect(v.pct1rm).toBe(Math.round((110 / 120) * 100)); // heaviest set vs bench 1RM
    expect(v.estimatedKcal).not.toBe(suggested.estimatedKcal);

    const day = after.weeks[1].days[0];
    expect(day.totalKcal).toBe(day.variations.reduce((s, x) => s + x.estimatedKcal, 0));
    expect(after.weeks[1].totalKcal).toBe(after.weeks[1].days.reduce((s, d) => s + d.totalKcal, 0));
  });

  it('touches only the addressed variation-week', () => {
    const before = plan();
    const after = setVariationSets(before, at, sets(100, [5]), 175);
    expect(after.weeks[0]).toEqual(before.weeks[0]);
    expect(after.weeks[1].days[0].variations[1]).toEqual(before.weeks[1].days[0].variations[1]);
    expect(after.weeks[1].days[1]).toEqual(before.weeks[1].days[1]);
  });

  it('null restores the app suggestion exactly', () => {
    const before = plan();
    const edited = setVariationSets(before, at, sets(100, [5]), 175);
    const restored = setVariationSets(edited, at, null, 175);
    const v = restored.weeks[1].days[0].variations[0];
    const original = before.weeks[1].days[0].variations[0];
    expect(v.sets).toEqual(original.sets);
    expect(v.pct1rm).toBe(original.pct1rm);
    expect(v.estimatedKcal).toBe(original.estimatedKcal);
    expect(v.userEdited).toBe(false);
    expect(restored.weeks[1].totalKcal).toBe(before.weeks[1].totalKcal);
  });

  it('keeps the prime a warm-up and everything else a working set', () => {
    const mine: LiftingSet[] = [
      { kind: 'warmup', weightKg: 95, reps: 1 },
      { kind: 'working', weightKg: 72.5, reps: 6 },
    ];
    const v = setVariationSets(plan(), at, mine, 175).weeks[1].days[0].variations[0];
    expect(v.sets.map((s) => s.kind)).toEqual(['warmup', 'working']);
    expect(v.pct1rm).toBeLessThan(95); // the %1RM reads the working sets only
  });

  it('an old block (no reference) keeps its old sets as a “legacy” reference', () => {
    const old = plan();
    const v0 = old.weeks[1].days[0].variations[0];
    delete (v0 as { reference?: unknown }).reference;
    expect(referenceOf(old, v0).method).toBe('legacy');
    const edited = setVariationSets(old, at, sets(100, [5]), 175);
    expect(edited.weeks[1].days[0].variations[0].reference).toMatchObject({ method: 'legacy', sets: v0.sets, oneRepMaxKg: 120 });
  });
});

describe('setWeekDates', () => {
  it('moves the edited week and shifts every later week, keeping their lengths', () => {
    // Week 2 was 14.09-20.09; the user did a holiday week and starts it on 21.09.
    const r = setWeekDates(plan(), 1, '2026-09-21', '2026-09-27');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const dates = r.plan.weeks.map((w) => [w.startDate, w.endDate]);
    expect(dates).toEqual([
      ['2026-09-07', '2026-09-13'], // week 1 untouched
      ['2026-09-21', '2026-09-27'],
      ['2026-09-28', '2026-10-04'],
      ['2026-10-05', '2026-10-11'], // deload follows too
    ]);
  });

  it('a longer week pushes the rest by its length', () => {
    const r = setWeekDates(plan(), 1, '2026-09-14', '2026-09-23'); // 10 days
    if (!r.ok) throw new Error(r.error);
    expect(r.plan.weeks[2].startDate).toBe('2026-09-24');
    expect(r.plan.weeks[2].endDate).toBe('2026-09-30');
  });

  it('a later week that the user had already lengthened keeps its own length', () => {
    const first = setWeekDates(plan(), 2, '2026-09-21', '2026-09-30'); // week 3: 10 days
    if (!first.ok) throw new Error(first.error);
    const second = setWeekDates(first.plan, 1, '2026-09-15', '2026-09-21');
    if (!second.ok) throw new Error(second.error);
    expect(second.plan.weeks[2].startDate).toBe('2026-09-22');
    expect(second.plan.weeks[2].endDate).toBe('2026-10-01'); // still 10 days
  });

  it('moving week 1 also moves the block’s start date', () => {
    const r = setWeekDates(plan(), 0, '2026-09-09', '2026-09-15');
    if (!r.ok) throw new Error(r.error);
    expect(r.plan.config.weekStartDate).toBe('2026-09-09');
    expect(r.plan.weeks[1].startDate).toBe('2026-09-16');
  });

  it('rejects an end before the start, an overlap with the previous week, and a week over 14 days', () => {
    expect(setWeekDates(plan(), 1, '2026-09-20', '2026-09-14')).toEqual({ ok: false, error: 'endBeforeStart' });
    expect(setWeekDates(plan(), 1, '2026-09-13', '2026-09-19')).toEqual({ ok: false, error: 'overlapsPrevious' });
    expect(setWeekDates(plan(), 1, '2026-09-14', '2026-09-30')).toEqual({ ok: false, error: 'tooLong' });
  });

  it('does not change the sets, only the dates', () => {
    const before = plan();
    const r = setWeekDates(before, 1, '2026-09-21', '2026-09-27');
    if (!r.ok) throw new Error(r.error);
    expect(r.plan.weeks.map((w) => w.days)).toEqual(before.weeks.map((w) => w.days));
  });
});

describe('dateForWeekday', () => {
  it('finds the scheduled weekday inside the week, even if the week starts mid-week', () => {
    const r = setWeekDates(plan(), 1, '2026-09-16', '2026-09-22'); // Wed → Tue
    if (!r.ok) throw new Error(r.error);
    expect(dateForWeekday(r.plan.weeks[1], 1)).toBe('2026-09-21'); // Monday
    expect(dateForWeekday(r.plan.weeks[1], 4)).toBe('2026-09-17'); // Thursday
  });

  it('null when a short week does not contain that weekday', () => {
    const r = setWeekDates(plan(), 1, '2026-09-15', '2026-09-17'); // Tue-Thu
    if (!r.ok) throw new Error(r.error);
    expect(dateForWeekday(r.plan.weeks[1], 1)).toBeNull();
  });
});

describe('refreshSuggestions / hasLegacySuggestions', () => {
  function legacy(): GeneratedBlockPlan {
    const p = plan();
    for (const w of p.weeks) for (const d of w.days) for (const v of d.variations) {
      delete (v as { reference?: unknown }).reference;
      v.sets = sets(999, [7, 7, 7, 7]); // "old model" numbers
    }
    return p;
  }

  it('detects an old-model block', () => {
    expect(hasLegacySuggestions(plan())).toBe(false);
    expect(hasLegacySuggestions(legacy())).toBe(true);
  });

  it('recalculates untouched variations, keeps the user’s edits and every week’s dates', () => {
    const old = legacy();
    const withEdit = setVariationSets(old, at, sets(95, [5, 5, 5]), 175);
    const moved = setWeekDates(withEdit, 1, '2026-09-21', '2026-09-27');
    if (!moved.ok) throw new Error(moved.error);

    const refreshed = refreshSuggestions(moved.plan, profile);
    const fresh = plan();
    // untouched → the new suggestion
    expect(refreshed.weeks[0].days[0].variations[0].sets).toEqual(fresh.weeks[0].days[0].variations[0].sets);
    // edited → the user's sets stay, with the new reference beside them
    const edited = refreshed.weeks[1].days[0].variations[0];
    // …gaining the new suggestion's prime in front
    expect(edited.sets.slice(1)).toEqual(sets(95, [5, 5, 5]));
    expect(edited.sets[0]).toEqual(edited.reference?.sets[0]);
    expect(edited.sets[0].kind).toBe('warmup');
    expect(edited.reference?.method).toBe('rpe');
    // dates kept
    expect(refreshed.weeks[1].startDate).toBe('2026-09-21');
    expect(hasLegacySuggestions(refreshed)).toBe(false);
  });
});

describe('days and weeks off', () => {
  const planned = { status: 'planned' as const, date: '2026-09-14', confirmedAt: 1 };
  const logged = { status: 'logged' as const, date: '2026-09-14', confirmedAt: 1, loggedAt: 2 };
  const withSession = (p: GeneratedBlockPlan, weekIndex: number, session: typeof planned | typeof logged) => ({
    ...p,
    weeks: p.weeks.map((w, i) =>
      i === weekIndex ? { ...w, days: w.days.map((d, di) => (di === 0 ? { ...d, session } : d)) } : w
    ),
  });

  it('skips one day (clearing its not-yet-logged session) and takes it back', () => {
    const skipped = setDaySkipped(withSession(plan(), 1, planned), { weekIndex: 1, dayIndex: 0 }, true);
    expect(skipped.weeks[1].days[0].skipped).toBe(true);
    expect(skipped.weeks[1].days[0].session).toBeUndefined();
    expect(skipped.weeks[1].days[1].skipped).toBeUndefined();
    const back = setDaySkipped(skipped, { weekIndex: 1, dayIndex: 0 }, false);
    expect(back.weeks[1].days[0].skipped).toBeUndefined();
  });

  it('"skip this week" leaves every date as it was; a logged session stays', () => {
    const before = withSession(plan(), 1, logged);
    const after = setWeekSkipped(before, 1, true);
    expect(after.weeks[1].skipped).toBe(true);
    expect(after.weeks.map((w) => w.startDate)).toEqual(before.weeks.map((w) => w.startDate));
    expect(after.weeks[1].days[0].session).toEqual(logged);
    expect(setWeekSkipped(after, 1, false).weeks[1].skipped).toBeUndefined();
  });

  it('"move the later weeks" puts a week off in, and removing it closes the gap again', () => {
    const before = withSession(plan(), 2, planned);
    const result = pauseAtWeek(before, 1);
    if (!result.ok) throw new Error(result.error);
    const paused = result.plan;
    expect(paused.config.breaks).toEqual([{ startDate: '2026-09-14', endDate: '2026-09-20' }]);
    expect(paused.weeks.map((w) => w.startDate)).toEqual(['2026-09-07', '2026-09-21', '2026-09-28', '2026-10-05']);
    expect(paused.weeks[2].days[0].session).toBeUndefined(); // its date moved
    const restored = removeBreak(paused, 0);
    expect(restored.config.breaks).toBeUndefined();
    expect(restored.weeks.map((w) => w.startDate)).toEqual(before.weeks.map((w) => w.startDate));
  });

  it('will not move a week the user already trained in', () => {
    expect(pauseAtWeek(withSession(plan(), 1, logged), 1)).toEqual({ ok: false, error: 'hasLoggedSession' });
  });
});

describe('setDayAccessories', () => {
  const lines = [
    { customName: '  Face pull ', sets: 3, reps: '15 @12.5kg' },
    { customName: '', sets: 3, reps: '10' },
  ];

  it('sets one day only, trimming and dropping empty lines', () => {
    const after = setDayAccessories(plan(), { weekIndex: 1, dayIndex: 0 }, lines, false);
    expect(after.weeks[1].days[0].accessories).toEqual([{ customName: 'Face pull', sets: 3, reps: '15 @12.5kg' }]);
    expect(after.weeks[1].days[0].accessoriesEdited).toBe(true);
    expect(after.weeks[2].days[0].accessories).toEqual(plan().weeks[2].days[0].accessories);
  });

  it('can carry the list to the same weekday of every later week, never earlier ones', () => {
    const after = setDayAccessories(plan(), { weekIndex: 1, dayIndex: 0 }, lines, true);
    expect(after.weeks[0].days[0].accessoriesEdited).toBeUndefined();
    expect(after.weeks[2].days[0].accessories[0].customName).toBe('Face pull');
    expect(after.weeks[3].days[0].accessories[0].customName).toBe('Face pull');
    expect(after.weeks[2].days[1].accessories).toEqual([]); // Thursday untouched
  });

  it('survives a refresh of the suggestions', () => {
    const edited = setDayAccessories(plan(), { weekIndex: 1, dayIndex: 0 }, lines, false);
    expect(refreshSuggestions(edited, profile).weeks[1].days[0].accessories[0].customName).toBe('Face pull');
  });
});
