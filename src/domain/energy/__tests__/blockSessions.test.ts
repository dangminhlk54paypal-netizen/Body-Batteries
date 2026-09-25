import {
  confirmTiming,
  daySessionStatus,
  dueSessions,
  liftingDates,
  sessionTimestamp,
  setDaySession,
  workoutsForDay,
} from '../blockSessions';
import { logDueSessions, logPlanDay } from '../../../services/training/blockSessionService';
import type { BlockSessionDeps } from '../../../services/training/blockSessionService';
import type { ActivityLogEntry, WorkoutSession } from '../../../types/energy';
import type { GeneratedBlockPlan, ResolvedDayPlan } from '../../../types/powerliftingBlock';

// Week of Mon 2026-09-21 with a Monday bench day (prime + working) and a Sunday deadlift day.
const day = (dayOfWeek: ResolvedDayPlan['dayOfWeek'], exercise: 'bench_press' | 'deadlift'): ResolvedDayPlan => ({
  dayOfWeek,
  variations: [
    {
      variation: { exercise, variationId: exercise === 'bench_press' ? 'bench_touch_and_go' : 'deadlift_standard', role: 'main' },
      pct1rm: 70,
      sets: [
        { kind: 'warmup', weightKg: 95, reps: 1 },
        { kind: 'working', weightKg: 72.5, reps: 6 },
      ],
      estimatedKcal: 100,
    },
  ],
  accessories: [{ customName: 'Row', sets: 3, reps: '10' }],
  totalKcal: 100,
  totalMinutes: 30,
});
const plan = (): GeneratedBlockPlan =>
  ({
    config: { id: 'b' },
    weeks: [
      {
        weekNumber: 1,
        isDeload: false,
        days: [day(1, 'bench_press'), day(0, 'deadlift')],
        totalKcal: 200,
        weeklyDeficitTargetKcal: null,
        startDate: '2026-09-21',
        endDate: '2026-09-27',
      },
    ],
  }) as unknown as GeneratedBlockPlan;
const liftEntry = (date: string): ActivityLogEntry => ({
  id: date,
  timestamp: new Date(`${date}T09:00:00`).getTime(),
  steps: 0,
  workouts: [{ type: 'squat', minutes: 30 }],
  energyKcal: 0,
  satietyDrainKcal: 0,
  energyDayApplied: date,
});
const MON = { weekIndex: 0, dayIndex: 0 };
const SUN = { weekIndex: 0, dayIndex: 1 };

describe('blockSessions — the pure part', () => {
  it('a day goes into Xả as its lifts with their planned sets (prime included), no accessories', () => {
    const [w] = workoutsForDay(plan().weeks[0].days[0]);
    expect(w).toMatchObject({ type: 'bench_press', variationId: 'bench_touch_and_go' });
    expect(w.sets?.map((s) => s.kind)).toEqual(['warmup', 'working']);
    expect(workoutsForDay(plan().weeks[0].days[0])).toHaveLength(1);
  });

  it('confirming: a day behind is logged now, today asks, a day ahead waits', () => {
    expect(confirmTiming('2026-09-21', '2026-09-25')).toBe('past');
    expect(confirmTiming('2026-09-25', '2026-09-25')).toBe('today');
    expect(confirmTiming('2026-09-27', '2026-09-25')).toBe('future');
  });

  it('a confirmed day is due from 18:00 of its date', () => {
    const p = setDaySession(plan(), SUN, { status: 'planned', date: '2026-09-27', confirmedAt: 1 });
    expect(dueSessions(p, sessionTimestamp('2026-09-27') - 1)).toEqual([]);
    expect(dueSessions(p, sessionTimestamp('2026-09-27'))).toEqual([
      { at: SUN, date: '2026-09-27', timestamp: sessionTimestamp('2026-09-27') },
    ]);
  });

  it('status: open, already in the log, planned (moved or not), logged (still there or not)', () => {
    const p = plan();
    const week = p.weeks[0];
    const none = new Set<string>();
    expect(daySessionStatus(week, week.days[0], none)).toEqual({ kind: 'open' });
    expect(daySessionStatus(week, week.days[0], new Set(['2026-09-21']))).toEqual({ kind: 'inLog' });
    const moved = setDaySession(p, MON, { status: 'planned', date: '2026-09-22', confirmedAt: 1 }).weeks[0];
    expect(daySessionStatus(moved, moved.days[0], none)).toEqual({ kind: 'planned', date: '2026-09-22', moved: true });
    const logged = setDaySession(p, MON, { status: 'logged', date: '2026-09-21', confirmedAt: 1 }).weeks[0];
    expect(daySessionStatus(logged, logged.days[0], new Set(['2026-09-21']))).toEqual({ kind: 'logged', date: '2026-09-21', present: true });
    expect(daySessionStatus(logged, logged.days[0], none)).toEqual({ kind: 'logged', date: '2026-09-21', present: false });
  });

  it('removing a confirmation drops the key; lifting days come from lifting entries only', () => {
    const p = setDaySession(setDaySession(plan(), MON, { status: 'planned', date: '2026-09-21', confirmedAt: 1 }), MON, null);
    expect('session' in p.weeks[0].days[0]).toBe(false);
    const walk = { ...liftEntry('2026-09-22'), workouts: [{ type: 'walking', minutes: 30 } as WorkoutSession] };
    expect([...liftingDates([liftEntry('2026-09-21'), walk])]).toEqual(['2026-09-21']);
  });
});

describe('blockSessionService', () => {
  function deps(existing: ActivityLogEntry[] = []) {
    const logged: { workouts: WorkoutSession[]; timestamp: number }[] = [];
    const d: BlockSessionDeps = {
      entriesInRange: async (from, to) =>
        existing.filter((e) => {
          const date = new Date(e.timestamp).toISOString().slice(0, 10);
          return date >= from && date <= to;
        }),
      logWorkouts: async (workouts, timestamp) => {
        logged.push({ workouts, timestamp });
      },
    };
    return { d, logged };
  }

  it('logs a day at 18:00 of its date (or now, if earlier) and marks it logged', async () => {
    const { d, logged } = deps();
    const now = new Date('2026-09-25T10:00:00').getTime();
    const past = await logPlanDay(plan(), MON, '2026-09-21', now, d);
    expect(logged[0].timestamp).toBe(sessionTimestamp('2026-09-21'));
    expect(past.weeks[0].days[0].session).toMatchObject({ status: 'logged', date: '2026-09-21', loggedAt: now });
    await logPlanDay(plan(), MON, '2026-09-25', now, d);
    expect(logged[1].timestamp).toBe(now); // trained this morning
  });

  it('never logs a day twice: lifts already in the log count as done', async () => {
    const { d, logged } = deps([liftEntry('2026-09-21')]);
    const p = await logPlanDay(plan(), MON, '2026-09-21', Date.now(), d);
    expect(logged).toHaveLength(0);
    expect(p.weeks[0].days[0].session?.status).toBe('logged');
  });

  it('logs every due session, leaves the rest waiting', async () => {
    const { d, logged } = deps();
    let p = setDaySession(plan(), MON, { status: 'planned', date: '2026-09-21', confirmedAt: 1 });
    p = setDaySession(p, SUN, { status: 'planned', date: '2026-09-27', confirmedAt: 1 });
    const next = await logDueSessions(p, new Date('2026-09-25T10:00:00').getTime(), d);
    expect(logged.map((l) => l.workouts[0].type)).toEqual(['bench_press']);
    expect(next?.weeks[0].days.map((x) => x.session?.status)).toEqual(['logged', 'planned']);
    expect(await logDueSessions(next!, new Date('2026-09-25T11:00:00').getTime(), d)).toBeNull();
  });
});
