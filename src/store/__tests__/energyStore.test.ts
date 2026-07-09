import { useEnergyStore } from '../energyStore';
import type { BatteryReading } from '../../types/battery';
import type { ActivityLogEntry } from '../../types/energy';
import { energyDayString } from '../../lib/dateUtils';
import * as batteryRepository from '../../data/repositories/batteryRepository';
import * as intakeRepository from '../../data/repositories/intakeRepository';

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

function findReading(id: 'energy' | 'movement'): BatteryReading {
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

    // A second, unrelated entry with 0 steps (just a workout) — removing it
    // should have zero effect on the movement pin.
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
