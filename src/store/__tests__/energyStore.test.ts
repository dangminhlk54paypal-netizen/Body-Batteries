import { useEnergyStore } from '../energyStore';
import type { BatteryReading } from '../../types/battery';
import type { ActivityLogEntry } from '../../types/energy';
import type { FoodItem, FoodLogEntry } from '../../types/food';
import { energyDayString } from '../../lib/dateUtils';
import * as batteryRepository from '../../data/repositories/batteryRepository';
import * as intakeRepository from '../../data/repositories/intakeRepository';
import { getAnyFoodById } from '../../data/food/foodLookup';

// updateFood resolves the FoodItem via getAnyFoodById — mock the whole lookup
// module so the test controls it (and so importing energyStore doesn't pull in
// the large generated USDA/CSV catalogs, unrelated to this task).
jest.mock('../../data/food/foodLookup', () => ({ getAnyFoodById: jest.fn() }));

// Mock the DB layer so importing energyStore never pulls in the real
// expo-sqlite module chain (unavailable in this test environment — unrelated
// to this task). All repositories used by the store go through getDb(), so
// stubbing it here is enough; every persistence call becomes a safe no-op
// that the store already tolerates via its try/catch blocks.
// `withTransactionAsync` must actually invoke its callback (batteryRepository
// .upsertReadings wraps its per-reading runAsync calls in one) — without it
// upsertReadings throws on every call and the whole surrounding try block
// (including anything queued after it, e.g. removeActivity's FIX #4
// intake_events cleanup) silently aborts.
jest.mock('../../data/db/database', () => ({
  getDb: () => ({
    runAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn().mockResolvedValue([]),
    execAsync: jest.fn().mockResolvedValue(undefined),
    withTransactionAsync: jest.fn(async (cb: () => Promise<void>) => {
      await cb();
    }),
  }),
}));

// settingsStore persists userProfile via AsyncStorage — use the library's
// official jest mock so importing it (transitively, via energyStore) doesn't
// hit the native module. A plain module-scope import can't be used here:
// babel-plugin-jest-hoist moves this jest.mock() call above ES import
// bindings, so the factory must require() the mock inline (jest's
// documented pattern for this exact case).
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// B2: logActivity/removeActivity should be exact (or safely-approximate, for
// clamped edge cases) inverses of each other — undoing a logged activity
// must bring readings back to the pre-log state. DB persistence calls inside
// the store are all wrapped in try/catch (see energyStore.ts), so these run
// fine without a real SQLite database — persistence just no-ops with a
// console.warn, which we silence here.

function baseEnergyReading(): BatteryReading {
  return {
    date: '2026-07-08',
    batteryTypeId: 'energy',
    level: 500,
    capacity: 2022,
    activityBonusKcal: 0,
    satietyReserveKcal: 1000, // == FULLNESS_CAPACITY_KCAL, so a full round-trip is exact
    lastSatietySyncAt: Date.now(),
  };
}

function baseMovementReading(): BatteryReading {
  return { date: '2026-07-08', batteryTypeId: 'movement', level: 0, capacity: 8000 };
}

function seedReadings() {
  useEnergyStore.setState({
    readings: [baseEnergyReading(), baseMovementReading()],
    masterPercentage: 0,
    foodLog: [],
    activityLog: [],
    lastDrainSyncAt: Date.now(),
    isLoaded: true,
  });
}

function findReading(id: BatteryReading['batteryTypeId']): BatteryReading {
  const r = useEnergyStore.getState().readings.find((x) => x.batteryTypeId === id);
  if (!r) throw new Error(`missing ${id} reading`);
  return r;
}

describe('energyStore — logActivity (B2)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    seedReadings();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('charges the movement pin by steps (FIX: it used to stay stuck at 0)', async () => {
    await useEnergyStore.getState().logActivity({ steps: 3000 });
    expect(findReading('movement').level).toBe(3000);
  });

  it('grows the energy goal (capacity/activityBonusKcal) from steps, leaves level untouched', async () => {
    // 8000 steps * 0.0005 * 78kg = 312 kcal (matches energyBalanceEngine.test.ts)
    await useEnergyStore.getState().logActivity({ steps: 8000 });
    const energy = findReading('energy');
    expect(energy.level).toBe(500);
    expect(energy.capacity).toBe(2022 + 312);
    expect(energy.activityBonusKcal).toBe(312);
    expect(energy.satietyReserveKcal).toBe(1000); // steps alone don't drain satiety
  });

  it('appends an independent, identifiable ActivityLogEntry with startAt/endAt stored', async () => {
    await useEnergyStore.getState().logActivity({
      steps: 1000,
      startAt: 1_000_000,
      endAt: 1_003_000,
    });
    const { activityLog } = useEnergyStore.getState();
    expect(activityLog).toHaveLength(1);
    expect(activityLog[0]).toMatchObject({
      steps: 1000,
      startAt: 1_000_000,
      endAt: 1_003_000,
    });
    expect(typeof activityLog[0].id).toBe('string');
  });

  it('a workout drains the satiety reserve and is snapshotted for exact undo', async () => {
    // 60 min football @ 78kg = 624 kcal (matches energyBalanceEngine.test.ts)
    await useEnergyStore.getState().logActivity({ workouts: [{ type: 'football', minutes: 60 }] });
    const energy = findReading('energy');
    expect(energy.capacity).toBe(2022 + 624);
    expect(energy.satietyReserveKcal).toBe(1000 - 624);
    const entry = useEnergyStore.getState().activityLog[0];
    expect(entry.energyKcal).toBe(624);
    expect(entry.satietyDrainKcal).toBe(624);
  });
});

// S-PL: a workout that carries `sets` is priced by the tonnage hybrid model
// (liftingEngine), not MET × minutes — with the default 78kg/168cm profile.
describe('energyStore — logActivity with set-based powerlifting (S-PL)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    seedReadings();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // warmup 20×10 + 2 working sets of 100×5; estimateLiftingMinutes = 8.
  // liftingSessionKcal @78kg/168cm: work ≈ 5.80 + 2×5.52 = 16.85 kcal,
  // rest = 2.0 MET × 78 × (8/60) = 20.8 kcal → round(37.6) = 38.
  const squatWorkout = {
    type: 'squat' as const,
    minutes: 8,
    sets: [
      { kind: 'warmup' as const, weightKg: 20, reps: 10 },
      { kind: 'working' as const, weightKg: 100, reps: 5 },
      { kind: 'working' as const, weightKg: 100, reps: 5 },
    ],
  };

  it('grows the goal + drains satiety by the tonnage kcal, not MET × minutes', async () => {
    await useEnergyStore.getState().logActivity({ workouts: [squatWorkout] });
    const energy = findReading('energy');
    expect(energy.capacity).toBe(2022 + 38);
    expect(energy.activityBonusKcal).toBe(38);
    expect(energy.satietyReserveKcal).toBe(1000 - 38);
    const entry = useEnergyStore.getState().activityLog[0];
    expect(entry.energyKcal).toBe(38);
    expect(entry.satietyDrainKcal).toBe(38);
  });

  it('charges the movement pin from the estimated minutes (squat MET 5 → 100 spm)', async () => {
    await useEnergyStore.getState().logActivity({ workouts: [squatWorkout] });
    expect(findReading('movement').level).toBe(800);
    expect(useEnergyStore.getState().activityLog[0].movementStepsApplied).toBe(800);
  });

  it('heavier bar → more kcal for the same sets/reps (the point of S-PL)', async () => {
    const heavier = {
      ...squatWorkout,
      sets: squatWorkout.sets.map((s) => ({ ...s, weightKg: s.weightKg + 40 })),
    };
    await useEnergyStore.getState().logActivity({ workouts: [heavier] });
    expect(findReading('energy').activityBonusKcal!).toBeGreaterThan(38);
  });

  it('removeActivity round-trips a set-based entry exactly', async () => {
    const before = useEnergyStore.getState().readings;
    await useEnergyStore.getState().logActivity({ workouts: [squatWorkout] });
    const entryId = useEnergyStore.getState().activityLog[0].id;

    await useEnergyStore.getState().removeActivity(entryId);

    expect(useEnergyStore.getState().activityLog).toHaveLength(0);
    expect(findReading('energy')).toEqual(before.find((r) => r.batteryTypeId === 'energy'));
    expect(findReading('movement')).toEqual(before.find((r) => r.batteryTypeId === 'movement'));
  });
});

describe('energyStore — removeActivity undoes logActivity exactly (B2)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    seedReadings();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('round-trips steps: readings + activityLog return to the pre-log state', async () => {
    const before = useEnergyStore.getState().readings;
    await useEnergyStore.getState().logActivity({ steps: 4000 });
    const entryId = useEnergyStore.getState().activityLog[0].id;

    await useEnergyStore.getState().removeActivity(entryId);

    expect(useEnergyStore.getState().activityLog).toHaveLength(0);
    expect(findReading('energy')).toEqual(before.find((r) => r.batteryTypeId === 'energy'));
    expect(findReading('movement')).toEqual(before.find((r) => r.batteryTypeId === 'movement'));
  });

  it('round-trips a workout: satiety reserve and goal both restored exactly', async () => {
    const before = useEnergyStore.getState().readings;
    await useEnergyStore.getState().logActivity({
      steps: 2000,
      workouts: [{ type: 'running', minutes: 30 }],
    });
    const entryId = useEnergyStore.getState().activityLog[0].id;

    await useEnergyStore.getState().removeActivity(entryId);

    expect(findReading('energy')).toEqual(before.find((r) => r.batteryTypeId === 'energy'));
    expect(findReading('movement')).toEqual(before.find((r) => r.batteryTypeId === 'movement'));
  });

  it('a mistakenly huge step count (e.g. minutes typed as steps) clamps safely and undo never goes negative', async () => {
    // Movement pin capacity is 8000 — logging 500,000 "steps" by mistake
    // clamps the pin at capacity rather than overflowing.
    await useEnergyStore.getState().logActivity({ steps: 500_000 });
    expect(findReading('movement').level).toBe(8000);

    const entryId = useEnergyStore.getState().activityLog[0].id;
    await useEnergyStore.getState().removeActivity(entryId);

    // Reversal is clamp-based (documented, same as removeFood) — it floors
    // at 0 instead of going negative, and the entry is gone either way.
    expect(findReading('movement').level).toBe(0);
    expect(useEnergyStore.getState().activityLog).toHaveLength(0);
  });

  it('FIX #3: removing an entry that clamped the pin recomputes from the remaining entries, not a naive subtraction', async () => {
    // A: 5000 steps (well under the 8000 cap). B: 8100 steps — cumulative
    // total (13100) overflows the cap, so B's own contribution gets clamped
    // at 8000. Undoing B with the OLD incremental `applyIntake(r, -8100)`
    // would wrongly drive the pin to 0 (wiping out A's steps too); the fix
    // recomputes the level from the remaining log (just A) instead.
    await useEnergyStore.getState().logActivity({ steps: 5000 });
    expect(findReading('movement').level).toBe(5000);

    await useEnergyStore.getState().logActivity({ steps: 8100 });
    expect(findReading('movement').level).toBe(8000); // clamped at capacity

    const entryB = useEnergyStore.getState().activityLog[1];
    await useEnergyStore.getState().removeActivity(entryB.id);

    expect(findReading('movement').level).toBe(5000);
    expect(useEnergyStore.getState().activityLog).toHaveLength(1);
  });

  it('removing an unknown id is a safe no-op', async () => {
    const before = useEnergyStore.getState().readings;
    await useEnergyStore.getState().removeActivity('does_not_exist');
    expect(useEnergyStore.getState().readings).toEqual(before);
  });
});

describe('energyStore — updateActivity (B2, remove+re-add strategy)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    seedReadings();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('replaces the entry (new id) and applies only the new effect', async () => {
    await useEnergyStore.getState().logActivity({ steps: 1000 });
    const oldId = useEnergyStore.getState().activityLog[0].id;

    await useEnergyStore.getState().updateActivity(oldId, { steps: 2500 });

    const { activityLog } = useEnergyStore.getState();
    expect(activityLog).toHaveLength(1);
    expect(activityLog[0].id).not.toBe(oldId);
    expect(activityLog[0].steps).toBe(2500);
    expect(findReading('movement').level).toBe(2500); // not 1000 + 2500
  });

  it('keeps fields not present in the patch (workouts) unchanged', async () => {
    await useEnergyStore.getState().logActivity({
      steps: 1000,
      workouts: [{ type: 'walking', minutes: 20 }],
    });
    const oldId = useEnergyStore.getState().activityLog[0].id;
    const oldEntry = useEnergyStore.getState().activityLog[0];

    await useEnergyStore.getState().updateActivity(oldId, { steps: 1500 });

    const newEntry = useEnergyStore.getState().activityLog[0];
    expect(newEntry.steps).toBe(1500);
    expect(newEntry.workouts).toEqual(oldEntry.workouts);
  });
});

// FIX #2+#3: removeActivity used to SET the movement pin absolutely from
// sum(remaining activityLog), which silently discards (a) whatever tickDrain
// already took off the pin since log time and (b) whatever a manual tap
// (addIntake) added on top of the logged entries. The fix reverses each
// entry's own marginal (clamped) contribution as a DELTA against the pin's
// CURRENT level instead. These three scenarios are exactly the ones called
// out in the fix spec.
describe('energyStore — removeActivity movement pin DELTA reversal (FIX #2+#3)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    seedReadings();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('scenario 1: removing the entry that overflowed the cap returns the pin to the OTHER entries total, not 0', async () => {
    await useEnergyStore.getState().logActivity({ steps: 5000 });
    expect(findReading('movement').level).toBe(5000);

    await useEnergyStore.getState().logActivity({ steps: 8100 }); // cumulative 13100 clamps at 8000
    expect(findReading('movement').level).toBe(8000);

    const entryB = useEnergyStore.getState().activityLog[1];
    await useEnergyStore.getState().removeActivity(entryB.id);

    expect(findReading('movement').level).toBe(5000);
  });

  it('scenario 2: passive drain since log time is preserved when an unrelated entry is removed (not "revived")', async () => {
    await useEnergyStore.getState().logActivity({ steps: 8000 }); // fills the pin
    expect(findReading('movement').level).toBe(8000);

    // A second entry with 0 steps (just a 10-min yoga workout). Since BUG A
    // it DOES carry a 1000 step-equivalent charge — but the pin was already
    // at cap when it was logged, so its MARGINAL contribution to the clamped
    // total is 0, and removing it must therefore have zero effect on the pin.
    // (The unsaturated workout-only delta is covered by the BUG A round-trip
    // test below.)
    await useEnergyStore.getState().logActivity({ workouts: [{ type: 'yoga', minutes: 10 }] });

    // Simulate tickDrain having drained the pin down to 4000 in the meantime,
    // exactly like the real passive drain would (without touching
    // activityLog — tickDrain never does).
    useEnergyStore.setState((s) => ({
      readings: s.readings.map((r) =>
        r.batteryTypeId === 'movement' ? { ...r, level: 4000 } : r
      ),
    }));

    const unrelatedEntry = useEnergyStore.getState().activityLog[1];
    await useEnergyStore.getState().removeActivity(unrelatedEntry.id);

    // Old (absolute-set) behavior would recompute sum(remaining) = 8000 and
    // "revive" the pin back to full, wiping out the drain. The fix leaves it
    // at 4000.
    expect(findReading('movement').level).toBe(4000);
  });

  it('scenario 3: a manual tap (addIntake) on top of a logged entry survives removing that entry', async () => {
    await useEnergyStore.getState().logActivity({ steps: 5000 });
    await useEnergyStore.getState().addIntake('movement', 2000); // manual tap — NOT in activityLog
    expect(findReading('movement').level).toBe(7000);

    const entryA = useEnergyStore.getState().activityLog[0];
    await useEnergyStore.getState().removeActivity(entryA.id);

    // Only A's own 5000-step contribution is reversed; the manual 2000 tap
    // (and, degenerately, floors at 0) survives.
    expect(findReading('movement').level).toBe(2000);
  });
});

// FIX #4: logActivity also writes intake_events rows (movement_${ts} /
// workout_${ts}_${i}) purely so the weekly/monthly Excel export sees the
// activity. removeActivity must clean those up using the SAME deterministic
// ids, or an edited/undone activity keeps showing up (and can double-count)
// in the export.
describe('energyStore — removeActivity cleans up intake_events (FIX #4)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    seedReadings();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deletes the movement_ and workout_ intake_events ids that logActivity wrote for this entry', async () => {
    const deleteSpy = jest
      .spyOn(intakeRepository, 'deleteIntakeEventsByIds')
      .mockResolvedValue(undefined);

    await useEnergyStore.getState().logActivity({
      steps: 3000,
      workouts: [
        { type: 'running', minutes: 20 },
        { type: 'yoga', minutes: 10 },
      ],
    });
    const entry = useEnergyStore.getState().activityLog[0];

    await useEnergyStore.getState().removeActivity(entry.id);

    expect(deleteSpy).toHaveBeenCalledWith([
      `movement_${entry.timestamp}`,
      `workout_${entry.timestamp}_0`,
      `workout_${entry.timestamp}_1`,
    ]);
  });

  it('does not try to delete a movement_ id when the entry had 0 steps', async () => {
    const deleteSpy = jest
      .spyOn(intakeRepository, 'deleteIntakeEventsByIds')
      .mockResolvedValue(undefined);

    await useEnergyStore.getState().logActivity({ workouts: [{ type: 'walking', minutes: 15 }] });
    const entry = useEnergyStore.getState().activityLog[0];

    await useEnergyStore.getState().removeActivity(entry.id);

    expect(deleteSpy).toHaveBeenCalledWith([`workout_${entry.timestamp}_0`]);
  });
});

// FIX #5: activityLog is grouped by ordinary calendar day, but the energy
// battery's reading is keyed by the 6am-reset "energy day" (energyDayString)
// — logging at 2am applies to YESTERDAY's energy-day reading, even though
// the entry still shows up under "today" after 6am. removeActivity must
// reverse the effect on the reading it actually landed on.
describe('energyStore — removeActivity reverses the correct energy-day reading (FIX #5)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    seedReadings();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('same energy-day: reverses in place on the store readings, exactly as before', async () => {
    const before = useEnergyStore.getState().readings;
    await useEnergyStore.getState().logActivity({
      steps: 2000,
      workouts: [{ type: 'running', minutes: 30 }],
    });
    const entry = useEnergyStore.getState().activityLog[0];
    expect(entry.energyDayApplied).toBe(energyDayString()); // sanity: logged "now"

    await useEnergyStore.getState().removeActivity(entry.id);

    expect(findReading('energy')).toEqual(before.find((r) => r.batteryTypeId === 'energy'));
  });

  it('different energy-day: reverses the HISTORICAL reading via the repository, current-day readings untouched', async () => {
    const historicalEnergy: BatteryReading = {
      date: '2026-07-01',
      batteryTypeId: 'energy',
      level: 800,
      capacity: 2500,
      activityBonusKcal: 300,
      satietyReserveKcal: 200,
      lastSatietySyncAt: 1_000,
    };
    const getReadingsSpy = jest
      .spyOn(batteryRepository, 'getReadingsForDate')
      .mockResolvedValue([historicalEnergy]);
    const upsertSpy = jest
      .spyOn(batteryRepository, 'upsertReadings')
      .mockResolvedValue(undefined);

    // Simulates activity logged 2am-6am (energyDayApplied = "yesterday") but
    // edited/removed after 6am, once the store has rolled onto today's
    // energy-day. Injected directly into state so the scenario doesn't
    // depend on mocking the wall clock.
    const crossDayEntry: ActivityLogEntry = {
      id: 'activity_cross_day',
      timestamp: 1_000,
      steps: 0,
      workouts: [{ type: 'running', minutes: 30 }],
      energyKcal: 300,
      satietyDrainKcal: 150,
      energyDayApplied: '2026-07-01', // deliberately NOT today's energy day
    };
    const beforeReadings = useEnergyStore.getState().readings;
    useEnergyStore.setState((s) => ({ activityLog: [...s.activityLog, crossDayEntry] }));

    await useEnergyStore.getState().removeActivity(crossDayEntry.id);

    // Today's readings (in the store) are untouched — this is the whole
    // point of the fix.
    expect(findReading('energy')).toEqual(beforeReadings.find((r) => r.batteryTypeId === 'energy'));
    expect(findReading('movement')).toEqual(beforeReadings.find((r) => r.batteryTypeId === 'movement'));

    // The historical row was fetched, reversed (mirroring
    // reverseActivityOnEnergyReading), and persisted on its own.
    expect(getReadingsSpy).toHaveBeenCalledWith('2026-07-01');
    expect(upsertSpy).toHaveBeenCalledWith([
      {
        ...historicalEnergy,
        capacity: 2500 - 300, // Math.max(0, 2500 - entry.energyKcal)
        activityBonusKcal: 0, // Math.max(0, 300 - 300)
        satietyReserveKcal: 350, // eatIntoReserve(200, 150)
      },
    ]);
  });
});

// FIX #6: logActivity always stamped `nowTimestamp()`, so updateActivity
// (remove + re-log) bumped an edited entry's timestamp to "now" — losing the
// original log time and reordering it to the end of the list.
describe('energyStore — logActivity timestampOverride + sorted activityLog (FIX #6)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    seedReadings();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('updateActivity preserves the original log timestamp instead of bumping it to "now"', async () => {
    await useEnergyStore.getState().logActivity({ steps: 1000 }, 5_000_000);
    const oldEntry = useEnergyStore.getState().activityLog[0];
    expect(oldEntry.timestamp).toBe(5_000_000);

    await useEnergyStore.getState().updateActivity(oldEntry.id, { steps: 1500 });

    const newEntry = useEnergyStore.getState().activityLog[0];
    expect(newEntry.id).not.toBe(oldEntry.id);
    expect(newEntry.timestamp).toBe(5_000_000);
  });

  it('keeps activityLog sorted by timestamp ascending after logging out of order', async () => {
    await useEnergyStore.getState().logActivity({ steps: 1000 }, 3_000);
    await useEnergyStore.getState().logActivity({ steps: 2000 }, 1_000);
    await useEnergyStore.getState().logActivity({ steps: 3000 }, 2_000);

    const timestamps = useEnergyStore.getState().activityLog.map((a) => a.timestamp);
    expect(timestamps).toEqual([1_000, 2_000, 3_000]);
  });
});

// FIX #8 prep: ActivityPatch.startAt/endAt now distinguish `undefined`
// (field absent from the patch — keep the current value) from `null` (user
// explicitly cleared the field — wipe it to undefined). Only the store/type
// layer is covered here; the edit-form UI wiring lands separately.
describe('energyStore — updateActivity startAt/endAt null vs undefined semantics (FIX #8 prep)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    seedReadings();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('omitting startAt/endAt from the patch (undefined) keeps the existing values', async () => {
    await useEnergyStore.getState().logActivity({ steps: 1000, startAt: 111, endAt: 222 });
    const oldId = useEnergyStore.getState().activityLog[0].id;

    await useEnergyStore.getState().updateActivity(oldId, { steps: 1500 });

    const entry = useEnergyStore.getState().activityLog[0];
    expect(entry.startAt).toBe(111);
    expect(entry.endAt).toBe(222);
  });

  it('an explicit null in the patch clears startAt/endAt back to undefined', async () => {
    await useEnergyStore.getState().logActivity({ steps: 1000, startAt: 111, endAt: 222 });
    const oldId = useEnergyStore.getState().activityLog[0].id;

    await useEnergyStore.getState().updateActivity(oldId, { startAt: null, endAt: null });

    const entry = useEnergyStore.getState().activityLog[0];
    expect(entry.startAt).toBeUndefined();
    expect(entry.endAt).toBeUndefined();
  });
});

// FIX #1: food undo, like activity undo, must reverse the energy (calorie
// ledger) charge on the energy-DAY it actually landed on (energyDayString of
// the eat time), not blindly on today's readings. A snack logged 2am-6am
// belongs to yesterday's ledger; undoing it after 6am must reverse the
// historical row, not today's. Nutrient batteries stay keyed by calendar day
// and always reverse in place.
function makeFoodItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'test_food',
    nameVi: 'Món thử',
    nameEn: 'Test food',
    category: 'grain',
    defaultServingG: 100,
    servingPresets: [],
    per100g: {
      energyKcal: 200,
      waterG: 0,
      proteinG: 10,
      fatG: 5,
      carbG: 30,
      fiberG: 0,
      sugarG: 0,
      calciumMg: 0,
      ironMg: 0,
      sodiumMg: 0,
      potassiumMg: 0,
      magnesiumMg: 0,
      zincMg: 0,
    },
    source: 'test',
    note: '',
    ...overrides,
  };
}

describe('energyStore — removeFood reverses the correct energy-day reading (FIX #1)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    seedReadings();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('same energy-day (logged now): reverses in place on the store readings', async () => {
    // Keep the satiety reserve below its cap so the eat/undo round-trip is
    // exact (eating caps at full, undo floors at 0 — see removeFood doc).
    useEnergyStore.setState((s) => ({
      readings: s.readings.map((r) =>
        r.batteryTypeId === 'energy' ? { ...r, satietyReserveKcal: 500 } : r
      ),
    }));
    const before = useEnergyStore.getState().readings;
    await useEnergyStore.getState().logFood(makeFoodItem(), 100, Date.now());
    const entry = useEnergyStore.getState().foodLog[0];
    expect(entry.energyDayApplied).toBe(energyDayString()); // sanity: logged "now"

    await useEnergyStore.getState().removeFood(entry.id);

    expect(useEnergyStore.getState().foodLog).toHaveLength(0);
    expect(findReading('energy')).toEqual(before.find((r) => r.batteryTypeId === 'energy'));
  });

  it('different energy-day: reverses the HISTORICAL reading via the repository, today untouched', async () => {
    const historicalEnergy: BatteryReading = {
      date: '2026-07-01',
      batteryTypeId: 'energy',
      level: 800,
      capacity: 2500,
      activityBonusKcal: 0,
      satietyReserveKcal: 400,
      lastSatietySyncAt: 1_000,
    };
    const getReadingsSpy = jest
      .spyOn(batteryRepository, 'getReadingsForDate')
      .mockResolvedValue([historicalEnergy]);
    const upsertSpy = jest
      .spyOn(batteryRepository, 'upsertReadings')
      .mockResolvedValue(undefined);

    // A food logged 2am-6am (energyDayApplied = "yesterday") then undone after
    // 6am, once the store rolled onto today's energy-day. Injected directly so
    // the scenario doesn't depend on mocking the wall clock.
    const crossDayEntry: FoodLogEntry = {
      id: 'food_cross_day',
      timestamp: 1_000,
      mealType: 'snack',
      foodId: 'test_food',
      foodNameVi: 'Món thử',
      grams: 100,
      energyKcal: 200,
      proteinG: 10,
      fatG: 5,
      carbG: 30,
      waterG: 0,
      mineralsMg: 0,
      energyDayApplied: '2026-07-01', // deliberately NOT today's energy day
    };
    const beforeReadings = useEnergyStore.getState().readings;
    useEnergyStore.setState((s) => ({ foodLog: [...s.foodLog, crossDayEntry] }));

    await useEnergyStore.getState().removeFood(crossDayEntry.id);

    // Today's energy reading (in the store) is untouched — the whole point.
    expect(findReading('energy')).toEqual(beforeReadings.find((r) => r.batteryTypeId === 'energy'));

    // The historical row was fetched, reversed, and persisted on its own:
    // burnEnergy(800, 200) = 600; satiety floor(400 - 200) = 200.
    expect(getReadingsSpy).toHaveBeenCalledWith('2026-07-01');
    expect(upsertSpy).toHaveBeenCalledWith([
      {
        ...historicalEnergy,
        level: 600,
        satietyReserveKcal: 200,
      },
    ]);
  });

  it('an old row without energyDayApplied is treated as same-day (backward compat)', async () => {
    // energyDayApplied intentionally absent (undefined) — pre-FIX-#1 row.
    const legacyEntry: FoodLogEntry = {
      id: 'food_legacy',
      timestamp: 1_000,
      mealType: 'snack',
      foodId: 'test_food',
      foodNameVi: 'Món thử',
      grams: 100,
      energyKcal: 150,
      proteinG: 0,
      fatG: 0,
      carbG: 0,
      waterG: 0,
      mineralsMg: 0,
    };
    // Pre-tax the energy reading as if this 150-kcal food had been logged
    // (both level and reserve, kept below cap so the in-place reversal is
    // exact), then define the pristine "before it was eaten" state to undo to.
    const expectedEnergy: BatteryReading = {
      ...baseEnergyReading(),
      level: 500,
      satietyReserveKcal: 500,
    };
    useEnergyStore.setState((s) => ({
      readings: s.readings.map((r) =>
        r.batteryTypeId === 'energy'
          ? { ...expectedEnergy, level: 650, satietyReserveKcal: 650 }
          : r
      ),
      foodLog: [legacyEntry],
    }));

    await useEnergyStore.getState().removeFood(legacyEntry.id);

    // Reversed in place on the store readings (same-day treatment), not via
    // the historical-row path.
    expect(findReading('energy')).toEqual(expectedEnergy);
  });
});

describe('energyStore — logFood entry ids are unique per log, not per minute', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    seedReadings();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // The food-log modal builds its timestamp with setHours(h, m, 0, 0), so two
  // logs of the same food inside one minute arrive with an IDENTICAL
  // timestamp. Ids used to be `food_<ts>_<foodId>`, which then collided on
  // food_log's PRIMARY KEY: both doses charged the pins, only one row reached
  // the table, and the live-computed micronutrient totals disagreed with the
  // list (and changed again after a restart).
  it('gives two same-timestamp logs of the same food distinct ids', async () => {
    const item = makeFoodItem();
    const timestamp = Date.now();

    await useEnergyStore.getState().logFood(item, 100, timestamp);
    await useEnergyStore.getState().logFood(item, 100, timestamp);

    const log = useEnergyStore.getState().foodLog;
    expect(log).toHaveLength(2);
    expect(log[0].timestamp).toBe(log[1].timestamp);
    expect(log[0].id).not.toBe(log[1].id);
  });

  it('removing one of two same-timestamp logs leaves the other intact', async () => {
    const item = makeFoodItem(); // 200 kcal / 100 g
    const timestamp = Date.now();

    await useEnergyStore.getState().logFood(item, 100, timestamp);
    await useEnergyStore.getState().logFood(item, 100, timestamp);
    expect(findReading('energy').level).toBe(900); // 500 base + 200 + 200

    await useEnergyStore.getState().removeFood(useEnergyStore.getState().foodLog[0].id);

    expect(useEnergyStore.getState().foodLog).toHaveLength(1);
    expect(findReading('energy').level).toBe(700); // exactly one dose reversed
  });
});

describe('energyStore — updateFood (FIX #2, reverse-then-relog)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    seedReadings();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('a grams change nets the battery delta correctly (not additive)', async () => {
    const item = makeFoodItem(); // 200 kcal / 100 g
    (getAnyFoodById as jest.Mock).mockReturnValue(item);

    // Log 100 g -> energy level 500 + 200 = 700.
    await useEnergyStore.getState().logFood(item, 100, Date.now());
    expect(findReading('energy').level).toBe(700);

    // Edit to 250 g -> reverse the 200, charge 500. Net level = 500 + 500.
    const id = useEnergyStore.getState().foodLog[0].id;
    await useEnergyStore.getState().updateFood(id, { grams: 250 });

    expect(useEnergyStore.getState().foodLog).toHaveLength(1);
    expect(useEnergyStore.getState().foodLog[0].grams).toBe(250);
    expect(findReading('energy').level).toBe(1000); // 500 base + 200*2.5, not additive
  });

  it('bails gracefully when the food id no longer resolves', async () => {
    const item = makeFoodItem();
    (getAnyFoodById as jest.Mock).mockReturnValue(item);
    await useEnergyStore.getState().logFood(item, 100, Date.now());
    const id = useEnergyStore.getState().foodLog[0].id;

    (getAnyFoodById as jest.Mock).mockReturnValue(undefined);
    const before = useEnergyStore.getState().readings;
    await useEnergyStore.getState().updateFood(id, { grams: 250 });

    // No-op: entry and readings unchanged.
    expect(useEnergyStore.getState().foodLog).toHaveLength(1);
    expect(useEnergyStore.getState().readings).toEqual(before);
  });

  // 'serving' is the open-ended portion unit (hộp/chai/ly) — an open-coded
  // pack/capsule check here used to send it down the grams branch, so editing
  // "2 hộp" to "3" silently became 3 GRAMS.
  it('a freely-named (serving) portion food also edits by count', async () => {
    const item = makeFoodItem({ portionUnit: 'serving', servingLabel: 'hộp', servingWeightG: 65 });
    (getAnyFoodById as jest.Mock).mockReturnValue(item);

    await useEnergyStore
      .getState()
      .logFood(item, 65, Date.now(), { portionUnit: 'serving', count: 1 });

    const id = useEnergyStore.getState().foodLog[0].id;
    await useEnergyStore.getState().updateFood(id, { count: 2 });

    const entry = useEnergyStore.getState().foodLog[0];
    expect(entry.count).toBe(2);
    expect(entry.grams).toBe(130); // 2 x 65 ml, not 2 grams
  });

  it('a portion-based (capsule) food edits by count', async () => {
    const item = makeFoodItem({ portionUnit: 'capsule', servingWeightG: 2 });
    (getAnyFoodById as jest.Mock).mockReturnValue(item);

    // 3 capsules * 2 g = 6 g -> energyKcal round(200 * 0.06) = 12.
    await useEnergyStore.getState().logFood(item, 6, Date.now(), { portionUnit: 'capsule', count: 3 });
    expect(findReading('energy').level).toBe(512);

    const id = useEnergyStore.getState().foodLog[0].id;
    await useEnergyStore.getState().updateFood(id, { count: 5 });

    // 5 capsules * 2 g = 10 g -> energyKcal round(200 * 0.1) = 20. Net 500 + 20.
    const entry = useEnergyStore.getState().foodLog[0];
    expect(entry.count).toBe(5);
    expect(entry.grams).toBe(10);
    expect(findReading('energy').level).toBe(520);
  });
});

// FIX #3: intakeLog + removeIntake. addIntake now records manual sub-battery
// quick-taps in intakeLog; removeIntake is its exact inverse, reversing the
// battery charge and (for macros that feed the ledger) the kcal + satiety
// top-up too.
describe('energyStore — removeIntake reverses addIntake (FIX #3)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Seed with energy (satiety below the cap so a macro round-trip is exact)
    // + a water + a protein sub-battery.
    useEnergyStore.setState({
      readings: [
        { ...baseEnergyReading(), satietyReserveKcal: 500 },
        { date: '2026-07-08', batteryTypeId: 'water', level: 0, capacity: 2000 },
        { date: '2026-07-08', batteryTypeId: 'protein', level: 0, capacity: 120 },
      ],
      masterPercentage: 0,
      foodLog: [],
      activityLog: [],
      intakeLog: [],
      lastDrainSyncAt: Date.now(),
      isLoaded: true,
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('a water tap is recorded in intakeLog and fully reversed (no kcal side-effect)', async () => {
    const energyBefore = useEnergyStore.getState().readings.find((r) => r.batteryTypeId === 'energy');

    await useEnergyStore.getState().addIntake('water', 300);
    expect(findReading('water').level).toBe(300);
    expect(useEnergyStore.getState().intakeLog).toHaveLength(1);

    const id = useEnergyStore.getState().intakeLog[0].id;
    await useEnergyStore.getState().removeIntake(id);

    expect(findReading('water').level).toBe(0);
    expect(useEnergyStore.getState().intakeLog).toHaveLength(0);
    // Water has no kcal, so the energy reading is untouched throughout.
    expect(useEnergyStore.getState().readings.find((r) => r.batteryTypeId === 'energy')).toEqual(
      energyBefore
    );
  });

  it('a protein tap also reverses the kcal charge and satiety top-up on undo', async () => {
    const energyBefore = useEnergyStore.getState().readings.find((r) => r.batteryTypeId === 'energy');

    // 50 g protein -> 200 kcal charged; satiety 500 -> 700.
    await useEnergyStore.getState().addIntake('protein', 50);
    expect(findReading('protein').level).toBe(50);
    expect(findReading('energy').level).toBe(700); // 500 + 200
    expect(findReading('energy').satietyReserveKcal).toBe(700); // 500 + 200

    const id = useEnergyStore.getState().intakeLog[0].id;
    await useEnergyStore.getState().removeIntake(id);

    expect(findReading('protein').level).toBe(0);
    // Energy level, satiety reserve, everything back to the pre-tap state.
    expect(useEnergyStore.getState().readings.find((r) => r.batteryTypeId === 'energy')).toEqual(
      energyBefore
    );
    expect(useEnergyStore.getState().intakeLog).toHaveLength(0);
  });
});

// BUG A: logActivity used to charge the movement pin from `steps` alone
// (`if (mi !== -1 && steps > 0) applyIntake(updated[mi], steps)`), so a
// workout-only entry (the activity modal's primary flow: type + minutes, no
// steps) never charged the movement pin — it translates workout minutes into
// step-equivalents (workoutStepEquivalent) and charges the pin by
// steps + that step-equivalent instead.
describe('energyStore — BUG A: workout-only logActivity charges the movement pin', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    seedReadings();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('a workout with NO steps still charges the movement pin (moderate MET -> 100 steps/min)', async () => {
    // yoga MET 2.5 < 6 -> moderate cadence: 45 min * 100 = 4500 step-equivalent.
    await useEnergyStore.getState().logActivity({ workouts: [{ type: 'yoga', minutes: 45 }] });
    expect(findReading('movement').level).toBe(4500);
  });

  it('a vigorous workout uses the 130 steps/min cadence', async () => {
    // running MET 9.8 >= 6 -> vigorous cadence: 30 min * 130 = 3900.
    await useEnergyStore.getState().logActivity({ workouts: [{ type: 'running', minutes: 30 }] });
    expect(findReading('movement').level).toBe(3900);
  });

  it('snapshots movementStepsApplied = steps + workout step-equivalent', async () => {
    await useEnergyStore.getState().logActivity({
      steps: 1000,
      workouts: [{ type: 'yoga', minutes: 45 }], // 4500 step-equivalent
    });
    const entry = useEnergyStore.getState().activityLog[0];
    expect(entry.movementStepsApplied).toBe(5500);
    expect(findReading('movement').level).toBe(5500);
  });

  it('removeActivity round-trips a workout-only entry exactly (movement pin back to pre-log state)', async () => {
    const before = useEnergyStore.getState().readings;
    await useEnergyStore.getState().logActivity({ workouts: [{ type: 'yoga', minutes: 45 }] });
    const entryId = useEnergyStore.getState().activityLog[0].id;

    await useEnergyStore.getState().removeActivity(entryId);

    expect(findReading('movement')).toEqual(before.find((r) => r.batteryTypeId === 'movement'));
    expect(findReading('energy')).toEqual(before.find((r) => r.batteryTypeId === 'energy'));
  });
});

// Backward compat: rows logged before the movementStepsApplied migration only
// ever charged the pin by `steps` — removeActivity must fall back to
// entry.steps for those, not treat the missing field as a 0 charge.
describe('energyStore — removeActivity backward compat for pre-migration rows', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    seedReadings();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('an entry without movementStepsApplied reverses by entry.steps only', async () => {
    // Pre-fill the pin to 3000, as if a pre-migration logActivity({ steps: 3000 })
    // had already run, then inject the legacy entry (no movementStepsApplied
    // field at all) directly into activityLog.
    useEnergyStore.setState((s) => ({
      readings: s.readings.map((r) =>
        r.batteryTypeId === 'movement' ? { ...r, level: 3000 } : r
      ),
    }));
    const legacyEntry: ActivityLogEntry = {
      id: 'activity_legacy',
      timestamp: Date.now(),
      steps: 3000,
      workouts: [],
      energyKcal: 0,
      satietyDrainKcal: 0,
      energyDayApplied: energyDayString(),
      // movementStepsApplied intentionally absent — simulates a pre-migration row.
    };
    useEnergyStore.setState((s) => ({ activityLog: [...s.activityLog, legacyEntry] }));

    await useEnergyStore.getState().removeActivity(legacyEntry.id);

    expect(findReading('movement').level).toBe(0);
  });
});

// BUG B: addIntake('movement', amount) (tap the movement battery cell) only
// converted kcal via kcalFromMacro, which is 0 for movement — so a direct
// movement charge never grew the energy battery's goal, unlike logActivity's
// step/workout path (growGoalFromActivity). Mirrors that same growth here.
describe('energyStore — BUG B: addIntake(movement) grows the energy goal', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    useEnergyStore.setState({
      readings: [
        baseEnergyReading(),
        baseMovementReading(),
        { date: '2026-07-08', batteryTypeId: 'water', level: 0, capacity: 2000 },
        { date: '2026-07-08', batteryTypeId: 'protein', level: 0, capacity: 120 },
      ],
      masterPercentage: 0,
      foodLog: [],
      activityLog: [],
      intakeLog: [],
      lastDrainSyncAt: Date.now(),
      isLoaded: true,
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('grows capacity/activityBonusKcal by stepsKcal(amount, weight, "walking"); leaves level + satiety untouched', async () => {
    const energyBefore = findReading('energy');

    await useEnergyStore.getState().addIntake('movement', 5000);

    const energy = findReading('energy');
    // default profile weightKg=78: stepsKcal(5000, 78, 'walking') = round(5000*0.0005*78) = 195
    expect(energy.capacity).toBe(energyBefore.capacity + 195);
    expect(energy.activityBonusKcal).toBe(195);
    expect(energy.level).toBe(energyBefore.level);
    expect(energy.satietyReserveKcal).toBe(energyBefore.satietyReserveKcal);
  });

  it('with opts.stepType "hiking" grows by the hiking rate instead', async () => {
    const energyBefore = findReading('energy');

    await useEnergyStore.getState().addIntake('movement', 5000, '', { stepType: 'hiking' });

    const energy = findReading('energy');
    // stepsKcal(5000, 78, 'hiking') = round(5000*0.0011*78) = 429
    expect(energy.activityBonusKcal).toBe(429);
    expect(energy.capacity).toBe(energyBefore.capacity + 429);
  });

  it('a water tap behaves exactly as before (no energy goal growth, no kcal side-effect)', async () => {
    const energyBefore = findReading('energy');

    await useEnergyStore.getState().addIntake('water', 300);

    expect(findReading('water').level).toBe(300);
    expect(findReading('energy')).toEqual(energyBefore);
  });

  it('a protein tap behaves exactly as before (charges level via kcalFromMacro, capacity untouched)', async () => {
    const energyBefore = findReading('energy');

    await useEnergyStore.getState().addIntake('protein', 50);

    const energy = findReading('energy');
    expect(energy.capacity).toBe(energyBefore.capacity); // unaffected — only movement grows the goal
    expect(energy.level).toBe(energyBefore.level + 200); // 50g * 4kcal/g
  });
});
