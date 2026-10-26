import { DEFAULT_MEAL_WINDOWS } from '../../../../lib/constants';
import type { ActivityLogEntry, CustomActivity } from '../../../../types/energy';
import { atLocalTime } from '../../../food/mealText/mapMealText';
import { buildActivityNames, decodeActivityPiece, type DecodedActivity } from '../parseActivityText';
import {
  activityDraftTotals,
  activityLogPlan,
  buildActivityDraft,
  isActivityBlocked,
  rowActivityKcal,
  rowSteps,
  rowWorkout,
  toggleActivityRow,
  withActivityMatch,
  withActivityMinutes,
  withActivitySets,
  withActivityTime,
  type ActivityTextContext,
} from '../mapActivityText';

// "Kể cả ngày", Mapping & Validation for workouts: which session, how long,
// which day / time, and what blocks or flags a row before it goes to Xả.
const TODAY = '2026-10-26';
const NOW = atLocalTime(TODAY, 21, 0); // told in the evening

function entry(partial: Partial<ActivityLogEntry> & Pick<ActivityLogEntry, 'workouts'>): ActivityLogEntry {
  return {
    id: 'e1',
    timestamp: atLocalTime(TODAY, 18, 0),
    steps: 0,
    energyKcal: 0,
    satietyDrainKcal: 0,
    energyDayApplied: TODAY,
    ...partial,
  };
}

function ctx(over: Partial<ActivityTextContext> = {}): ActivityTextContext {
  return {
    now: NOW,
    today: TODAY,
    baseDate: TODAY,
    maxDaysBack: 7,
    mealWindows: DEFAULT_MEAL_WINDOWS,
    weightKg: 70,
    heightCm: 175,
    customActivities: [],
    customExercises: [],
    recentActivities: [],
    ...over,
  };
}

const names = buildActivityNames();
function decoded(text: string, customs: CustomActivity[] = []): DecodedActivity {
  const d = decodeActivityPiece(text, customs.length ? buildActivityNames(customs) : names);
  if (!d) throw new Error(`not a workout: ${text}`);
  return d;
}
const draft = (texts: string[], c: ActivityTextContext = ctx()) => buildActivityDraft(texts.map((t) => decoded(t)), c);

describe('buildActivityDraft', () => {
  it('turns a said workout into a ready row with its time and kcal', () => {
    const [row] = draft(['sáng 6h chạy bộ 30 phút']);
    expect(row).toMatchObject({ minutes: 30, minutesSource: 'said', day: TODAY, selected: true, issues: [] });
    expect(row.startAt).toBe(atLocalTime(TODAY, 6, 0));
    expect(rowWorkout(row, ctx())).toEqual({ type: 'running', minutes: 30 });
    // MET 9.8 × 70 kg × 0.5 h
    expect(rowActivityKcal(row, ctx())).toBe(343);
  });

  it('a length that was never said uses the last session, else blocks the row', () => {
    const recent = [entry({ startAt: atLocalTime('2026-10-24', 6, 0), workouts: [{ type: 'running', minutes: 40 }] })];
    const [usual] = draft(['chạy bộ'], ctx({ recentActivities: recent }));
    expect(usual).toMatchObject({ minutes: 40, minutesSource: 'usual', issues: ['usualMinutes'], selected: true });
    const [none] = draft(['chạy bộ']);
    expect(none.issues).toContain('noMinutes');
    expect(isActivityBlocked(none)).toBe(true);
    expect(none.selected).toBe(false);
    expect(toggleActivityRow(none).selected).toBe(false);
  });

  it('an unknown activity is blocked until one is picked', () => {
    const [row] = draft(['leo núi 2 tiếng']);
    expect(row.issues).toEqual(['noMatch']);
    const picked = withActivityMatch(row, { kind: 'type', type: 'walking' }, ctx());
    expect(picked).toMatchObject({ minutes: 120, issues: [], selected: true });
  });

  it('a walk with steps logs the steps, not minutes on top', () => {
    const [row] = draft(['đi bộ 30 phút 4000 bước']);
    expect(rowWorkout(row, ctx())).toBeNull();
    expect(rowSteps(row)).toBe(4000);
    const [stepsOnly] = draft(['8000 bước']);
    expect(stepsOnly.issues).toEqual([]);
    expect(rowSteps(stepsOnly)).toBe(8000);
  });

  it('builds set-based lift and bodybuilding sessions, like the gym sheets', () => {
    const [squat, pulldown] = draft(['squat 5x5 100kg', 'kéo xô 4x12 40kg']);
    expect(rowWorkout(squat, ctx())).toMatchObject({ type: 'squat', sets: squat.sets });
    expect(squat.minutesSource).toBe('sets');
    expect(rowWorkout(pulldown, ctx())).toMatchObject({
      type: 'bodybuilding',
      bbExerciseId: 'lat_pulldown',
      bbMuscle: 'back',
      bbTier: 'compound',
    });
    expect(rowActivityKcal(squat, ctx())).toBeGreaterThan(0);
  });

  it('a barbell lift needs its weight; sets fix it', () => {
    const [row] = draft(['squat 5x5']);
    expect(row.issues).toContain('noWeight');
    const fixed = withActivitySets(row, [{ kind: 'working', reps: 5, weightKg: 100 }], ctx());
    expect(fixed.issues).toEqual([]);
  });

  it('a lift said with minutes but no sets is a gym session by minutes', () => {
    const [row] = draft(['squat 45 phút']);
    expect(row.match).toEqual({ kind: 'type', type: 'gym_strength' });
    expect(rowWorkout(row, ctx())).toEqual({ type: 'gym_strength', minutes: 45 });
  });

  it('blocks a time in the future and a day too long ago', () => {
    const [later] = draft(['23h chạy bộ 30 phút']);
    expect(later.issues).toContain('futureTime');
    const [old] = buildActivityDraft([{ ...decoded('chạy bộ 30 phút'), time: { dayOffset: -10, hour: null, minute: null, meal: null } }], ctx());
    expect(old.issues).toContain('tooOld');
  });

  it('reads "hôm qua" onto yesterday', () => {
    const [row] = draft(['hôm qua tối đá bóng từ 19h đến 20h30']);
    expect(row.day).toBe('2026-10-25');
    expect(row.startAt).toBe(atLocalTime('2026-10-25', 19, 0));
    expect(row.minutesSource).toBe('range');
  });

  it('a session already in Xả around that time starts unticked and says so', () => {
    const recent = [entry({ startAt: atLocalTime(TODAY, 18, 0), workouts: [{ type: 'running', minutes: 30 }] })];
    const [row] = draft(['18h30 chạy bộ 30 phút'], ctx({ recentActivities: recent }));
    expect(row.duplicate?.id).toBe('e1');
    expect(row.issues).toContain('duplicate');
    expect(row.selected).toBe(false);
    expect(toggleActivityRow(row).selected).toBe(true);
    // Another day, or another activity: no duplicate.
    expect(draft(['18h30 đạp xe 30 phút'], ctx({ recentActivities: recent }))[0].duplicate).toBeNull();
  });

  it('flags a very long session but still logs it', () => {
    const [row] = draft(['đạp xe 6 tiếng']);
    expect(row.issues).toEqual(['longSession']);
    expect(row.selected).toBe(true);
  });

  it('a custom activity logs its own MET', () => {
    const custom: CustomActivity[] = [{ id: 'custom_1', nameVi: 'Leo núi', category: 'other', met: 7 }];
    const c = ctx({ customActivities: custom });
    const [row] = buildActivityDraft([decoded('leo núi 2 tiếng', custom)], c);
    expect(rowWorkout(row, c)).toEqual({ type: 'custom', minutes: 120, customName: 'Leo núi', customMet: 7 });
  });

  it('edits keep a typed length when another activity is picked', () => {
    const [row] = draft(['chạy bộ 30 phút']);
    const typed = withActivityMinutes(row, 50, ctx());
    expect(withActivityMatch(typed, { kind: 'type', type: 'cycling' }, ctx()).minutes).toBe(50);
    const timed = withActivityTime(typed, TODAY, null, ctx());
    expect(timed.startAt).toBeNull();
  });
});

describe('activityLogPlan', () => {
  it('one Xả entry per workout, gym exercises at the same time form one session', () => {
    const rows = draft(['sáng 6h chạy bộ 30 phút', '17h squat 5x5 100kg', '17h kéo xô 4x12 40kg', 'đi bộ 8000 bước']);
    const plan = activityLogPlan(rows, ctx());
    expect(plan).toHaveLength(3);
    expect(plan[0]).toMatchObject({
      today: true,
      startAt: atLocalTime(TODAY, 6, 0),
      endAt: atLocalTime(TODAY, 6, 30),
      steps: 0,
      workouts: [{ type: 'running', minutes: 30 }],
    });
    expect(plan[1].workouts.map((w) => w.type)).toEqual(['squat', 'bodybuilding']);
    expect(plan[1].rowIds).toEqual(['a1', 'a2']);
    expect(plan[2]).toMatchObject({ steps: 8000, workouts: [] });
    expect(plan[2].startAt).toBeUndefined();
  });

  it('skips unticked and blocked rows; a past day logs at its start, else noon', () => {
    const rows = draft(['hôm qua chạy bộ 30 phút', 'leo núi 2 tiếng', 'hôm qua 7h đạp xe 20 phút']);
    const plan = activityLogPlan(rows, ctx());
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ today: false, timestamp: atLocalTime('2026-10-25', 12, 0) });
    expect(plan[1]).toMatchObject({ today: false, timestamp: atLocalTime('2026-10-25', 7, 0) });
    expect(activityLogPlan([toggleActivityRow(rows[0])], ctx())).toEqual([]);
  });

  it('totals count only what will be logged', () => {
    const rows = draft(['chạy bộ 30 phút', 'leo núi 2 tiếng']);
    expect(activityDraftTotals(rows, ctx())).toEqual({ count: 1, kcal: 343 });
  });
});
