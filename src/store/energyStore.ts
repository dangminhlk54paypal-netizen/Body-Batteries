import { create } from 'zustand';
import type { BatteryReading, IntakeEvent, BatteryId } from '../types/battery';
import type { WorkoutSession, ActivityLogEntry } from '../types/energy';
import type { FoodItem, FoodLogEntry, PortionUnit } from '../types/food';
import { nutritionForGrams, mealTypeForTimestamp, gramsForPortion } from '../domain/food/foodNutrition';
import { getAnyFoodById } from '../data/food/foodLookup';
import {
  addFoodLogEntry,
  getFoodLogForDate,
  deleteFoodLogEntry,
} from '../data/repositories/foodLogRepository';
import {
  addActivityLogEntry,
  getActivityLogForDate,
  deleteActivityLogEntry,
} from '../data/repositories/activityLogRepository';
import {
  applyIntake,
  applyDrain,
  capacityForMode,
  clampElapsedHoursAtMidnight,
  clampLevel,
  computeMasterLevel,
  createDailyReading,
  toPercentage,
} from '../domain/battery/batteryEngine';
import {
  createEnergyReading,
  reconcileEnergyCapacity,
  kcalFromMacro,
  chargeEnergy,
  burnEnergy,
  growGoalFromActivity,
} from '../domain/energy/energyBalanceEngine';
import {
  applyCircadianDrain,
  eatIntoReserve,
  drainFromWorkout,
} from '../domain/energy/satietyEngine';
import { dailyCalorieTarget } from '../domain/energy/weightGoal';
import {
  workoutKcal,
  totalWorkoutKcal,
  stepsKcal,
  dailyExpenditure,
} from '../domain/energy/metabolismEngine';
import { getModeById } from '../domain/modes/modeDefinitions';
import { checkLowBattery, type BatteryAlert } from '../domain/rules/lowBatteryRules';
import {
  getReadingsForDate,
  getLatestEnergyReadingBefore,
  upsertReadings,
} from '../data/repositories/batteryRepository';
import {
  addIntakeEvent,
  deleteIntakeEventsByIds,
  getIntakeEventsForDate,
} from '../data/repositories/intakeRepository';
import { getDailyLog, upsertDailyLog } from '../data/repositories/dailyLogRepository';
import {
  logAppleHealthBurned,
  recordSyncTimestamp,
  getLastSyncTimestamp,
  getAppleHealthBurnedForDate,
} from '../data/repositories/healthSignalsRepository';
import {
  getTodayEnergyBurned,
  calculateTotalBurned,
} from '../services/health/appleHealthSync';
import {
  applyFoodToDayReadings,
  reverseFoodOnDayReadings,
  buildReadingsForMissedDay,
} from '../domain/food/backfillEngine';
import { useSettingsStore } from './settingsStore';
import { todayString, dateString, energyDayString, nowTimestamp } from '../lib/dateUtils';
import { DEFAULT_BATTERIES } from '../lib/constants';
import type { ModeId } from '../types/modes';

// Patch accepted by updateActivity — same shape as logActivity's argument,
// all fields optional, but startAt/endAt carry TWO distinct "no value"
// meanings (FIX #8 prep — UI wiring lands separately):
//   - `undefined` = field not present in the patch at all — keep the entry's
//     current value (the pre-existing behavior, e.g. patching only `steps`
//     leaves startAt/endAt untouched).
//   - `null` = the user explicitly CLEARED the field in the edit form — wipe
//     it back to `undefined` on the entry, do NOT keep the old value.
// steps/workouts have no such distinction: they're always required-shaped
// (steps defaults to 0, workouts to []), so omitting them from the patch
// unambiguously means "keep current".
interface ActivityPatch {
  steps?: number;
  workouts?: WorkoutSession[];
  startAt?: number | null;
  endAt?: number | null;
}

interface EnergyState {
  readings: BatteryReading[];
  masterPercentage: number; // Hướng B: this is the ENERGY (calorie-balance) battery %
  foodLog: FoodLogEntry[]; // today's logged meals (for the "Hôm nay đã ăn" view)
  activityLog: ActivityLogEntry[]; // today's logged activity events (steps/workouts, B2)
  // FIX #3: today's MANUAL sub-battery quick-taps (addIntake — water/protein/
  // etc.), so they can be listed and individually undone. Excludes the derived
  // rows logActivity/addCalories also write to intake_events (steps/workout/
  // calories, and the movement/energy batteries) — see isManualQuickTapIntake.
  intakeLog: IntakeEvent[];
  // Timestamp of the last passive-drain tick actually applied to `readings`
  // (loadToday / tickDrain / resetForNewDay). useLiveEnergyReading uses this to
  // extrapolate a smooth per-second display between real ticks, without
  // writing to the store or DB every second.
  lastDrainSyncAt: number;
  isLoaded: boolean;

  // Apple Health integration (Phases 1-3). Burned kcal is DISPLAY-ONLY — it
  // never feeds `battery_readings.capacity` or any existing goal/satiety math
  // (see src/services/health/appleHealthSync.ts doc). Synced from loadToday
  // plus a manual trigger the UI wires up separately; falls back to a
  // BMR-based estimate (metabolismEngine.dailyExpenditure) whenever HealthKit
  // is denied/unavailable/returns no data, so the UI always has *some*
  // number, just tagged 'estimated' instead of 'synced'.
  appleHealthBurnedKcal: number;
  lastAppleHealthSync: number | null;
  appleHealthStatus: 'idle' | 'syncing' | 'synced' | 'estimated';
  syncAppleHealthBurned: () => Promise<void>;

  loadToday: (modeId: ModeId) => Promise<void>;
  addIntake: (batteryId: BatteryId, amount: number, note?: string) => Promise<BatteryAlert[]>;
  addCalories: (kcal: number, note?: string) => Promise<void>;
  // `portion` is optional (backward-compatible: existing callers that pass 3
  // args keep working, defaulting to gram-based logging). When the caller
  // already converted a pack/capsule count into `grams` via gramsForPortion,
  // it passes the original portionUnit/count here purely so the log entry
  // can display "2 viên" instead of the converted gram figure.
  logFood: (
    item: FoodItem,
    grams: number,
    timestamp: number,
    portion?: { portionUnit?: PortionUnit; count?: number }
  ) => Promise<void>;
  removeFood: (id: string) => Promise<void>;
  // FIX #2: edit a logged food (grams/count/time). Mirrors updateActivity's
  // reverse-then-relog strategy: fully undo the old entry via removeFood, then
  // log a fresh one with the patch applied. `count` is only meaningful for
  // pack/capsule (TPCN) foods; omitting a field keeps the entry's current value.
  updateFood: (
    id: string,
    patch: { grams?: number; count?: number; timestamp?: number }
  ) => Promise<void>;
  // S-S4 (backfill): log a food onto a PAST day's readings — nutrients keyed
  // by the entry's calendar day, kcal by its 6am-reset energy day — via a
  // read-modify-write of that day's persisted rows. Today's in-memory numbers
  // must not move, with one deliberate exception (spec 3c): in the 0h-6am
  // overlap a target day can BE the currently loaded one, and is then charged
  // in place. Never touches the continuous satiety reserve — a past meal's
  // satiation has already worn off. A timestamp on the current day delegates
  // to logFood (the one true same-day path).
  logFoodForPastDate: (
    item: FoodItem,
    grams: number,
    timestamp: number,
    portion?: { portionUnit?: PortionUnit; count?: number }
  ) => Promise<void>;
  // Exact inverse of logFoodForPastDate for an entry fetched from the DB
  // (e.g. the History day-detail view) — the entry is NOT in store.foodLog.
  // If it is (today's list), delegates to removeFood, which also owns the
  // same-day satiety reversal.
  removeFoodForPastDate: (entry: FoodLogEntry) => Promise<void>;
  // FIX #3: undo a manual sub-battery quick-tap (the exact inverse of
  // addIntake): reverse the battery charge and, for macros that also feed the
  // calorie ledger, reverse the kcal + satiety top-up too.
  removeIntake: (id: string) => Promise<void>;
  // `startAt`/`endAt` (B2) are optional and display-only — see
  // types/energy.ts ActivityLogEntry doc (no replay engine).
  // `timestampOverride` (FIX #6): when set, used as the entry's `timestamp`
  // instead of `nowTimestamp()` — lets updateActivity re-log a patched entry
  // under its ORIGINAL log time, so editing an activity doesn't bump it to
  // "now" and reorder/misdate it.
  logActivity: (
    activity: {
      steps?: number;
      workouts?: WorkoutSession[];
      startAt?: number;
      endAt?: number;
    },
    timestampOverride?: number
  ) => Promise<void>;
  removeActivity: (id: string) => Promise<void>;
  // Simplest-and-safest strategy (B2): reverses the old entry via
  // removeActivity, then logs a brand-new entry (new id) with the patch
  // applied on top. See the implementation below for why in-place editing
  // (keeping the same id) was not worth the extra complexity here.
  updateActivity: (id: string, patch: ActivityPatch) => Promise<void>;
  tickDrain: (elapsedHours: number, modeId: ModeId) => Promise<void>;
  resetForNewDay: (modeId: ModeId) => Promise<void>;
}

function currentProfile() {
  return useSettingsStore.getState().userProfile;
}

// masterPercentage is the calorie LEDGER's percentage (eaten / goal, S-M) —
// the overeating watch keys off it. The headline satiety % is derived from
// satietyReserveKcal in useLiveEnergyReading instead. Falls back to the
// nutrient average if no energy reading exists (defensive / old data).
function energyPercentage(readings: BatteryReading[]): number {
  const e = readings.find((r) => r.batteryTypeId === 'energy');
  return e ? toPercentage(e.level, e.capacity) : computeMasterLevel(readings);
}

// The ledger's goal is the SAFE daily calorie target from the weight goal
// (S-P) — not raw maintenance — plus whatever activity already grew it today.
function applySafeCalorieTarget(reading: BatteryReading, profile: ReturnType<typeof currentProfile>): BatteryReading {
  return {
    ...reading,
    capacity: dailyCalorieTarget(profile).targetKcal + (reading.activityBonusKcal ?? 0),
  };
}

// Bring the satiety reserve up to `nowMs`: drain for the time elapsed since
// the persisted anchor, then move the anchor. Always computed from the anchor
// in one span (per-tick accumulation would round each slice to 0 kcal).
function syncSatietyReserve(
  reading: BatteryReading,
  profile: ReturnType<typeof currentProfile>,
  nowMs: number
): BatteryReading {
  const anchor = reading.lastSatietySyncAt ?? nowMs;
  return {
    ...reading,
    satietyReserveKcal: applyCircadianDrain(
      reading.satietyReserveKcal ?? 0,
      profile,
      anchor,
      nowMs
    ),
    lastSatietySyncAt: nowMs,
  };
}

// Reverse a logged activity's effect on an energy reading — the exact
// mirror of the growGoalFromActivity + drainFromWorkout applied by
// logActivity, using the entry's own energyKcal/satietyDrainKcal snapshot.
// Pulled out as its own pure function (FIX #5) so removeActivity can apply
// it either to `readings` in the store (same energy-day) or to a historical
// row fetched from the repository (different energy-day), without
// duplicating the reversal math.
function reverseActivityOnEnergyReading(
  r: BatteryReading,
  entry: ActivityLogEntry
): BatteryReading {
  return {
    ...r,
    // Reverse growGoalFromActivity: shrink the goal back down by the same
    // kcal it grew, floored at 0 so a shrink can never go negative.
    capacity: Math.max(0, r.capacity - entry.energyKcal),
    activityBonusKcal: Math.max(0, (r.activityBonusKcal ?? 0) - entry.energyKcal),
    // Reverse drainFromWorkout: give the satiety reserve the drained kcal
    // back, capped at full — mirroring how removeFood floors its reversal at
    // 0 in the opposite direction.
    satietyReserveKcal: eatIntoReserve(r.satietyReserveKcal ?? 0, entry.satietyDrainKcal),
  };
}

// Reverse a logged food's charge on an energy reading — the exact mirror of
// the chargeEnergy + eatIntoReserve applied by logFood, using the entry's own
// energyKcal snapshot. Pulled out as its own pure function (FIX #1, mirroring
// reverseActivityOnEnergyReading) so removeFood can apply it either to
// `readings` in the store (same energy-day) or to a historical row fetched
// from the repository (different energy-day). Reversal on the reserve floors
// at 0, mirroring how eating capped at full — approximate around the cap/floor,
// acceptable for a self-tracking estimate.
function reverseFoodOnEnergyReading(
  r: BatteryReading,
  entry: FoodLogEntry
): BatteryReading {
  const burned = burnEnergy(r, entry.energyKcal);
  return {
    ...burned,
    satietyReserveKcal: Math.max(0, (burned.satietyReserveKcal ?? 0) - entry.energyKcal),
  };
}

// FIX #3: which intake_events rows count as MANUAL sub-battery quick-taps (the
// ones addIntake creates and removeIntake can undo), versus the derived rows
// logActivity/addCalories also write to the same table purely for the Excel
// export (steps / workout / calories) or that target the movement/energy
// batteries. Only the former belong in `intakeLog`.
function isManualQuickTapIntake(event: IntakeEvent): boolean {
  if (event.batteryTypeId === 'movement' || event.batteryTypeId === 'energy') return false;
  if (event.note === 'steps' || event.note === 'calories') return false;
  if (event.note.startsWith('workout')) return false;
  return true;
}

// Which mode a backfilled day's fresh readings should be sized by: the mode
// the user actually ran that day (daily_logs) when known, else the current
// one — a day the app was never opened on has no record of its own.
async function modeIdForDate(date: string): Promise<ModeId> {
  try {
    const log = await getDailyLog(date);
    if (log) return log.modeId as ModeId;
  } catch (e) {
    console.warn('modeIdForDate lookup failed:', e);
  }
  return useSettingsStore.getState().currentMode;
}

// Update the energy reading inside a readings array (it's the only battery
// with satiety/ledger state; nutrient readings pass through untouched).
function mapEnergy(
  readings: BatteryReading[],
  fn: (r: BatteryReading) => BatteryReading
): BatteryReading[] {
  return readings.map((r) => (r.batteryTypeId === 'energy' ? fn(r) : r));
}

// Build the default set of readings in memory (no persistence): the 6
// nutrient batteries keyed by the calendar day + the energy battery keyed by
// the 6am-reset energy day, sized from the safe calorie target.
function buildDefaultReadings(date: string, modeId: ModeId): BatteryReading[] {
  const mode = getModeById(modeId);
  const profile = currentProfile();
  const nutrients = DEFAULT_BATTERIES.filter(
    (b) => b.isActive && b.id !== 'master' && b.id !== 'energy'
  ).map((b) => createDailyReading(date, b.id as BatteryId, mode, 0));
  const energy: BatteryReading = {
    ...applySafeCalorieTarget(createEnergyReading(energyDayString(), profile), profile),
    satietyReserveKcal: 0,
    lastSatietySyncAt: Date.now(),
  };
  return [...nutrients, energy];
}

export const useEnergyStore = create<EnergyState>((set, get) => ({
  readings: [],
  masterPercentage: 0,
  foodLog: [],
  activityLog: [],
  intakeLog: [],
  lastDrainSyncAt: Date.now(),
  isLoaded: false,
  appleHealthBurnedKcal: 0,
  lastAppleHealthSync: null,
  appleHealthStatus: 'idle',

  // Apple Health integration (Phases 1-3): orchestrates the sync described on
  // EnergyState.syncAppleHealthBurned above. 2-hour cache check first (memory,
  // falling back to the persisted timestamp so a fresh app launch doesn't
  // immediately re-hit HealthKit if a previous session synced recently) →
  // request permission + fetch → on success, persist + mark 'synced'; on ANY
  // failure (not linked/denied/unavailable/no data/thrown error — all
  // collapsed by getTodayEnergyBurned returning null), compute the BMR
  // fallback and mark 'estimated'. Never throws — every failure path resolves
  // to a state update, so callers (loadToday) can fire this without a guard.
  syncAppleHealthBurned: async () => {
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const now = Date.now();
    let { lastAppleHealthSync } = get();

    if (lastAppleHealthSync === null) {
      try {
        lastAppleHealthSync = await getLastSyncTimestamp();
      } catch (e) {
        console.warn('syncAppleHealthBurned: getLastSyncTimestamp failed:', e);
      }
    }

    if (lastAppleHealthSync !== null && now - lastAppleHealthSync < TWO_HOURS_MS) {
      // Cache still fresh — skip hitting HealthKit again, but restore
      // appleHealthBurnedKcal/Status from what's actually persisted for
      // TODAY rather than leaving the in-memory defaults (0/'idle') a fresh
      // app launch starts with. If nothing was synced for today's calendar
      // day yet (e.g. the cached timestamp is from just before midnight),
      // recompute the BMR estimate instead of showing yesterday's/zero data.
      try {
        const cachedKcal = await getAppleHealthBurnedForDate(todayString());
        if (cachedKcal !== null) {
          set({ appleHealthBurnedKcal: cachedKcal, lastAppleHealthSync, appleHealthStatus: 'synced' });
          return;
        }
      } catch (e) {
        console.warn('syncAppleHealthBurned: getAppleHealthBurnedForDate failed:', e);
      }
      const estimate = dailyExpenditure(currentProfile()).total;
      set({ appleHealthBurnedKcal: estimate, lastAppleHealthSync, appleHealthStatus: 'estimated' });
      return;
    }

    set({ appleHealthStatus: 'syncing' });

    try {
      const result = await getTodayEnergyBurned();
      if (result) {
        const total = calculateTotalBurned(result.active, result.resting);
        const ts = nowTimestamp();
        try {
          await logAppleHealthBurned(total, ts, todayString());
          await recordSyncTimestamp('synced');
        } catch (e) {
          console.warn('syncAppleHealthBurned persistence failed:', e);
        }
        set({ appleHealthBurnedKcal: total, lastAppleHealthSync: ts, appleHealthStatus: 'synced' });
        return;
      }
    } catch (e) {
      console.warn('syncAppleHealthBurned fetch failed:', e);
    }

    // Fallback: HealthKit denied/unavailable/no data/errored — estimate
    // today's burn from the profile's BMR + passive activity instead, so the
    // UI still has a number, just tagged as an estimate rather than synced.
    const estimate = dailyExpenditure(currentProfile()).total;
    const ts = nowTimestamp();
    try {
      await recordSyncTimestamp('estimated');
    } catch (e) {
      console.warn('syncAppleHealthBurned persistence failed:', e);
    }
    set({ appleHealthBurnedKcal: estimate, lastAppleHealthSync: ts, appleHealthStatus: 'estimated' });
  },

  loadToday: async (modeId) => {
    const today = todayString();
    const energyDay = energyDayString();
    const mode = getModeById(modeId);
    const profile = currentProfile();

    try {
      const todayRows = await getReadingsForDate(today);

      // Nutrient batteries: keyed by the calendar day, capacities re-applied
      // from the current mode (levels kept, re-clamped).
      let nutrients = todayRows.filter((r) => r.batteryTypeId !== 'energy');
      if (nutrients.length === 0) {
        nutrients = DEFAULT_BATTERIES.filter(
          (b) => b.isActive && b.id !== 'master' && b.id !== 'energy'
        ).map((b) => createDailyReading(today, b.id as BatteryId, mode, 0));
      } else {
        nutrients = nutrients.map((r) => {
          const capacity = capacityForMode(r.batteryTypeId, mode);
          return { ...r, capacity, level: clampLevel(r.level, capacity) };
        });
      }

      // Energy battery: keyed by the 6am-reset energy day, so between
      // midnight and 6am the ledger keeps counting on "yesterday's" row.
      const energyRows =
        energyDay === today ? todayRows : await getReadingsForDate(energyDay);
      let energy = energyRows.find((r) => r.batteryTypeId === 'energy');
      if (energy) {
        energy = applySafeCalorieTarget(reconcileEnergyCapacity(energy, profile), profile);
      } else {
        // First launch of this energy day: fresh ledger — but the satiety
        // reserve is continuous, so carry it (and its drain anchor) over
        // from the most recent previous energy reading.
        const prev = await getLatestEnergyReadingBefore(energyDay);
        energy = {
          ...applySafeCalorieTarget(createEnergyReading(energyDay, profile), profile),
          satietyReserveKcal: prev?.satietyReserveKcal ?? 0,
          lastSatietySyncAt: prev?.lastSatietySyncAt ?? Date.now(),
        };
      }
      energy = syncSatietyReserve(energy, profile, Date.now());

      const readings = [...nutrients, energy];
      await upsertReadings(readings);
      await upsertDailyLog({ date: today, modeId });
      const foodLog = await getFoodLogForDate(today);
      const activityLog = await getActivityLogForDate(today);
      // FIX #3: only the manual sub-battery quick-taps — filter out the
      // steps/workout/calories rows logActivity/addCalories also wrote here.
      const intakeLog = (await getIntakeEventsForDate(today)).filter(isManualQuickTapIntake);

      set({
        readings,
        masterPercentage: energyPercentage(readings),
        foodLog,
        activityLog,
        intakeLog,
        lastDrainSyncAt: Date.now(),
        isLoaded: true,
      });
    } catch (e) {
      // Storage unavailable (e.g. SQLite-less web build). Render in-memory
      // defaults so the screen never goes blank.
      console.warn('loadToday failed, using in-memory defaults:', e);
      const readings = buildDefaultReadings(today, modeId);
      set({
        readings,
        masterPercentage: energyPercentage(readings),
        foodLog: [],
        activityLog: [],
        intakeLog: [],
        lastDrainSyncAt: Date.now(),
        isLoaded: true,
      });
    }

    // Apple Health sync (Phases 1-3): independent of the battery-readings
    // load above — fire-and-forget so a slow/denied/unavailable HealthKit
    // call never blocks or breaks loadToday. syncAppleHealthBurned() never
    // throws itself (every failure path inside it resolves to the BMR
    // estimate instead), but this catch is a defensive backstop matching the
    // console.warn pattern used everywhere else in this store.
    get()
      .syncAppleHealthBurned()
      .catch((e) => console.warn('syncAppleHealthBurned failed:', e));
  },

  addIntake: async (batteryId, amount, note = '') => {
    const { readings } = get();

    const idx = readings.findIndex((r) => r.batteryTypeId === batteryId);
    if (idx === -1) return [];

    const updated = [...readings];
    updated[idx] = applyIntake(updated[idx], amount);
    const toPersist: BatteryReading[] = [updated[idx]];

    // Eating protein/carbs also charges the calorie ledger (4 kcal/g) and
    // tops up the satiety reserve (the headline fullness battery).
    const kcal = kcalFromMacro(batteryId, amount);
    if (kcal > 0) {
      const ei = updated.findIndex((r) => r.batteryTypeId === 'energy');
      if (ei !== -1) {
        updated[ei] = chargeEnergy(updated[ei], kcal);
        updated[ei] = {
          ...updated[ei],
          satietyReserveKcal: eatIntoReserve(updated[ei].satietyReserveKcal ?? 0, kcal),
        };
        toPersist.push(updated[ei]);
      }
    }

    // FIX #3: build the event up front so it can be appended to intakeLog for
    // an immediate, undoable listing (only manual sub-battery quick-taps go in
    // — the same predicate loadToday filters by).
    const ts = nowTimestamp();
    const event: IntakeEvent = { id: `${batteryId}_${ts}`, timestamp: ts, batteryTypeId: batteryId, amount, note };

    // Optimistic UI update (master = energy %).
    set((s) => ({
      readings: updated,
      masterPercentage: energyPercentage(updated),
      intakeLog: isManualQuickTapIntake(event) ? [...s.intakeLog, event] : s.intakeLog,
    }));

    try {
      await addIntakeEvent(event);
      await upsertReadings(toPersist);
    } catch (e) {
      console.warn('addIntake persistence failed:', e);
    }

    const { lowBatteryThreshold } = useSettingsStore.getState();
    // Only alert on the battery just topped up, if it's still low. The energy
    // battery is excluded here (S-M): starting the day at 0% eaten is normal,
    // not something to warn about — its own alert (overeating) is handled by
    // useLowEnergyWatch instead.
    const relevant = updated.filter((r) => r.batteryTypeId === batteryId);
    return checkLowBattery(relevant, lowBatteryThreshold);
  },

  // Manually log eaten calories (the "nhập tay" source).
  addCalories: async (kcal, note = '') => {
    const { readings } = get();
    const ei = readings.findIndex((r) => r.batteryTypeId === 'energy');
    if (ei === -1 || kcal <= 0) return;

    const updated = [...readings];
    updated[ei] = chargeEnergy(updated[ei], kcal);
    updated[ei] = {
      ...updated[ei],
      satietyReserveKcal: eatIntoReserve(updated[ei].satietyReserveKcal ?? 0, kcal),
    };
    set({ readings: updated, masterPercentage: energyPercentage(updated) });

    try {
      const ts = nowTimestamp();
      await addIntakeEvent({ id: `energy_${ts}`, timestamp: ts, batteryTypeId: 'energy', amount: kcal, note: note || 'calories' });
      await upsertReadings([updated[ei]]);
    } catch (e) {
      console.warn('addCalories persistence failed:', e);
    }
  },

  // Log a food from the database (food_items.csv): charges the energy battery by
  // the food's real kcal and the nutrient batteries (protein/carbs/water/
  // minerals) by the portion's macros. Unlike addIntake, energy is NOT re-derived
  // from macros here (that would double-count) — we use the CSV's energy_kcal,
  // which also accounts for fat (9 kcal/g).
  logFood: async (item, grams, timestamp, portion) => {
    const { readings } = get();
    if (grams <= 0) return;

    const n = nutritionForGrams(item, grams);
    const mealType = mealTypeForTimestamp(timestamp, useSettingsStore.getState().mealWindows);

    // Nutrient sub-batteries fed by food (no kcal side-effect — energy is added
    // once below). water_g ≈ ml; minerals is a coarse mg rollup.
    const nutrientCharges: Partial<Record<BatteryId, number>> = {
      protein: n.proteinG,
      carbs: n.carbG,
      water: n.waterG,
      minerals: n.mineralsMg,
    };

    const updated = readings.map((r) => {
      if (r.batteryTypeId === 'energy') {
        const charged = chargeEnergy(r, n.energyKcal);
        return {
          ...charged,
          satietyReserveKcal: eatIntoReserve(charged.satietyReserveKcal ?? 0, n.energyKcal),
        };
      }
      const charge = nutrientCharges[r.batteryTypeId];
      return charge && charge > 0 ? applyIntake(r, charge) : r;
    });

    const entry: FoodLogEntry = {
      id: `food_${timestamp}_${item.id}`,
      timestamp,
      mealType,
      foodId: item.id,
      foodNameVi: item.nameVi,
      grams,
      energyKcal: n.energyKcal,
      proteinG: n.proteinG,
      fatG: n.fatG,
      carbG: n.carbG,
      waterG: n.waterG,
      mineralsMg: n.mineralsMg,
      portionUnit: portion?.portionUnit,
      count: portion?.count,
      // FIX #1: snapshot which energy-day's reading actually received the kcal
      // charge above, so removeFood can reverse it on the right day even if the
      // food was logged 0h-6am (yesterday's ledger) and undone after 6am.
      energyDayApplied: energyDayString(new Date(timestamp)),
    };

    set((s) => ({
      readings: updated,
      masterPercentage: energyPercentage(updated),
      foodLog: [...s.foodLog, entry],
    }));

    try {
      await upsertReadings(updated.filter((r) => r.batteryTypeId !== 'master'));
      await addFoodLogEntry(entry);
    } catch (e) {
      console.warn('logFood persistence failed:', e);
    }
  },

  // Undo a logged food: reverse its charge on the energy + nutrient batteries
  // and remove it from today's log. (Reversal is clamp-based, so a charge that
  // overflowed the cap when added is only approximately restored — acceptable
  // for a self-tracking estimate.)
  removeFood: async (id) => {
    const { readings, foodLog } = get();
    const entry = foodLog.find((f) => f.id === id);
    if (!entry) return;

    const reverseCharges: Partial<Record<BatteryId, number>> = {
      protein: entry.proteinG,
      carbs: entry.carbG,
      water: entry.waterG,
      minerals: entry.mineralsMg,
    };

    // FIX #1 (mirrors removeActivity/FIX #5): the food's kcal charge was
    // applied at log time to the reading for `entry.energyDayApplied` (the
    // 6am-reset energy day), which is NOT necessarily the energy-day currently
    // loaded in the store — a food logged 0h-6am belongs to yesterday's
    // ledger. Reverse it on the correct reading: if it's today's energy-day
    // (or the field is missing on an old row → treat as same-day), reverse
    // in-place on `readings`; otherwise leave `readings.energy` untouched and
    // reverse+persist the historical row separately below. The nutrient
    // batteries stay keyed by the calendar day and always reverse in-place.
    const currentEnergyDay = energyDayString();
    const sameEnergyDay =
      entry.energyDayApplied === undefined || entry.energyDayApplied === currentEnergyDay;

    const updated = readings.map((r) => {
      if (r.batteryTypeId === 'energy') {
        return sameEnergyDay ? reverseFoodOnEnergyReading(r, entry) : r;
      }
      const amt = reverseCharges[r.batteryTypeId];
      return amt && amt > 0 ? applyIntake(r, -amt) : r;
    });

    set({
      readings: updated,
      masterPercentage: energyPercentage(updated),
      foodLog: foodLog.filter((f) => f.id !== id),
    });

    try {
      await upsertReadings(updated.filter((r) => r.batteryTypeId !== 'master'));
      await deleteFoodLogEntry(id);

      if (!sameEnergyDay && entry.energyDayApplied) {
        // Historical energy-day: fetch, reverse, and persist that day's row on
        // its own — today's `readings` must NOT be touched.
        const historicalRows = await getReadingsForDate(entry.energyDayApplied);
        const historicalEnergy = historicalRows.find((r) => r.batteryTypeId === 'energy');
        if (historicalEnergy) {
          await upsertReadings([reverseFoodOnEnergyReading(historicalEnergy, entry)]);
        }
      }
    } catch (e) {
      console.warn('removeFood persistence failed:', e);
    }
  },

  // FIX #2: edit a logged food. Simplest-and-safest strategy, mirroring
  // updateActivity: fully reverse the old entry (removeFood) then log a fresh
  // one (logFood) with the patch applied on top of the original values — under
  // the original log time by default so editing doesn't reorder/misdate it.
  updateFood: async (id, patch) => {
    const entry = get().foodLog.find((f) => f.id === id);
    if (!entry) return;

    // Resolve the FoodItem the entry came from (any catalog, override-aware).
    // Bail gracefully if it's gone — better a no-op than logging garbage.
    const item = getAnyFoodById(entry.foodId);
    if (!item) return;

    const originalTimestamp = entry.timestamp;

    // Portion-based foods (TPCN packs/capsules) are edited by count; everything
    // else by grams. Fall back to the entry's current value for the field the
    // patch didn't touch.
    const isPortionBased = item.portionUnit === 'pack' || item.portionUnit === 'capsule';
    const newGrams =
      isPortionBased && patch.count !== undefined
        ? gramsForPortion(item, patch.count)
        : patch.grams ?? entry.grams;

    await get().removeFood(id);
    await get().logFood(item, newGrams, patch.timestamp ?? originalTimestamp, {
      portionUnit: item.portionUnit,
      count: patch.count ?? entry.count,
    });
  },

  // S-S4: log a food onto a past day. Charging is split per target (spec 3c):
  // the entry's CALENDAR day owns the nutrient batteries, its ENERGY day (6am
  // reset) owns the kcal ledger — each is charged in the store when it happens
  // to be the currently loaded day (0h-6am overlap), and via a
  // read-modify-write of that day's persisted rows otherwise. Satiety is never
  // touched on either path: unlike logFood, a backfilled meal is not "food in
  // the belly right now".
  logFoodForPastDate: async (item, grams, timestamp, portion) => {
    if (grams <= 0) return;

    const entryCalendarDay = dateString(new Date(timestamp));
    const entryEnergyDay = energyDayString(new Date(timestamp));
    const calendarIsCurrent = entryCalendarDay === todayString();
    const energyIsCurrent = entryEnergyDay === energyDayString();

    // Fully on the current day → the normal same-day path (including its
    // satiety top-up: the meal really was eaten today) is exactly right.
    if (calendarIsCurrent && energyIsCurrent) {
      await get().logFood(item, grams, timestamp, portion);
      return;
    }

    const n = nutritionForGrams(item, grams);
    const entry: FoodLogEntry = {
      id: `food_${timestamp}_${item.id}`,
      timestamp,
      mealType: mealTypeForTimestamp(timestamp, useSettingsStore.getState().mealWindows),
      foodId: item.id,
      foodNameVi: item.nameVi,
      grams,
      energyKcal: n.energyKcal,
      proteinG: n.proteinG,
      fatG: n.fatG,
      carbG: n.carbG,
      waterG: n.waterG,
      mineralsMg: n.mineralsMg,
      portionUnit: portion?.portionUnit,
      count: portion?.count,
      energyDayApplied: entryEnergyDay,
    };

    // Targets that ARE the currently loaded day (0h-6am overlap): charge them
    // in place so Home updates immediately. applyFoodToDayReadings is the
    // satiety-free sibling of logFood's charging.
    if (calendarIsCurrent || energyIsCurrent) {
      const { readings, foodLog } = get();
      const updated = readings.map((r) => {
        const targeted = r.batteryTypeId === 'energy' ? energyIsCurrent : calendarIsCurrent;
        return targeted ? applyFoodToDayReadings([r], n)[0] : r;
      });
      set({
        readings: updated,
        masterPercentage: energyPercentage(updated),
        // A same-calendar-day entry belongs in today's "Hôm nay đã ăn" list.
        foodLog: calendarIsCurrent
          ? [...foodLog, entry].sort((a, b) => a.timestamp - b.timestamp)
          : foodLog,
      });
      try {
        await upsertReadings(updated.filter((r) => r.batteryTypeId !== 'master'));
      } catch (e) {
        console.warn('logFoodForPastDate persistence failed:', e);
      }
    }

    // Historical targets: read-modify-write those days' rows on their own —
    // today's in-memory readings must NOT be touched. A day the app was never
    // opened on gets a fresh reading set built for it.
    try {
      const dayModeId = await modeIdForDate(entryCalendarDay);
      const built = () =>
        buildReadingsForMissedDay(
          entryCalendarDay,
          entryEnergyDay,
          currentProfile(),
          getModeById(dayModeId)
        );

      const toCharge: BatteryReading[] = [];
      if (!calendarIsCurrent) {
        const nutrients = (await getReadingsForDate(entryCalendarDay)).filter(
          (r) => r.batteryTypeId !== 'energy' && r.batteryTypeId !== 'master'
        );
        toCharge.push(...(nutrients.length > 0 ? nutrients : built().nutrients));
      }
      if (!energyIsCurrent) {
        const energy = (await getReadingsForDate(entryEnergyDay)).find(
          (r) => r.batteryTypeId === 'energy'
        );
        toCharge.push(energy ?? built().energy);
      }
      await upsertReadings(applyFoodToDayReadings(toCharge, n));

      // Make the day exist for History/export even if it never had a log row.
      await upsertDailyLog({ date: entryCalendarDay, modeId: dayModeId });
      await addFoodLogEntry(entry);
    } catch (e) {
      console.warn('logFoodForPastDate persistence failed:', e);
    }
  },

  // S-S4: undo a backfilled/past entry fetched from the DB — the exact mirror
  // of logFoodForPastDate, target by target, again without ever touching the
  // satiety reserve (that meal's satiation drained away long ago).
  removeFoodForPastDate: async (entry) => {
    // In today's loaded list → removeFood already owns the full reversal
    // (including same-day satiety and its own historical-energy-day branch).
    if (get().foodLog.some((f) => f.id === entry.id)) {
      await get().removeFood(entry.id);
      return;
    }

    const entryCalendarDay = dateString(new Date(entry.timestamp));
    const entryEnergyDay =
      entry.energyDayApplied ?? energyDayString(new Date(entry.timestamp));
    const calendarIsCurrent = entryCalendarDay === todayString();
    const energyIsCurrent = entryEnergyDay === energyDayString();

    // BUG-2 (S-S6): idempotence guard. The caller hands us a detached entry
    // object, so a double-tap on the delete button would otherwise reverse
    // the same charge twice on the historical rows. Only proceed if the row
    // still exists in the DB; a lookup failure falls through to the attempt
    // (the DB write path has its own try/catch).
    try {
      const stillLogged = (await getFoodLogForDate(entryCalendarDay)).some(
        (f) => f.id === entry.id
      );
      if (!stillLogged) return;
    } catch (e) {
      console.warn('removeFoodForPastDate existence check failed:', e);
    }

    // Currently loaded targets (0h-6am overlap): reverse in place.
    if (calendarIsCurrent || energyIsCurrent) {
      const updated = get().readings.map((r) => {
        const targeted = r.batteryTypeId === 'energy' ? energyIsCurrent : calendarIsCurrent;
        return targeted ? reverseFoodOnDayReadings([r], entry)[0] : r;
      });
      set({ readings: updated, masterPercentage: energyPercentage(updated) });
      try {
        await upsertReadings(updated.filter((r) => r.batteryTypeId !== 'master'));
      } catch (e) {
        console.warn('removeFoodForPastDate persistence failed:', e);
      }
    }

    // Historical targets: reverse on that day's persisted rows. A missing row
    // (e.g. already swept by cleanup) is skipped — deleting the log entry
    // still proceeds so the list reflects the user's intent.
    try {
      const toReverse: BatteryReading[] = [];
      if (!calendarIsCurrent) {
        const rows = await getReadingsForDate(entryCalendarDay);
        toReverse.push(
          ...rows.filter((r) => r.batteryTypeId !== 'energy' && r.batteryTypeId !== 'master')
        );
      }
      if (!energyIsCurrent) {
        const energy = (await getReadingsForDate(entryEnergyDay)).find(
          (r) => r.batteryTypeId === 'energy'
        );
        if (energy) toReverse.push(energy);
      }
      if (toReverse.length > 0) {
        await upsertReadings(reverseFoodOnDayReadings(toReverse, entry));
      }
      await deleteFoodLogEntry(entry.id);
    } catch (e) {
      console.warn('removeFoodForPastDate persistence failed:', e);
    }
  },

  // FIX #3: undo a manual sub-battery quick-tap — the exact inverse of
  // addIntake. Reverse the battery charge (apply -amount), and if that battery
  // also feeds the calorie ledger (kcalFromMacro > 0) reverse the kcal charge
  // (burnEnergy) and floor the satiety reserve by that kcal, mirroring
  // removeFood's floor-at-0 reversal.
  removeIntake: async (id) => {
    const { readings, intakeLog } = get();
    const event = intakeLog.find((e) => e.id === id);
    if (!event) return;

    const toPersist: BatteryReading[] = [];
    const updated = readings.map((r) => {
      if (r.batteryTypeId === event.batteryTypeId) {
        const reversed = applyIntake(r, -event.amount);
        toPersist.push(reversed);
        return reversed;
      }
      return r;
    });

    const kcal = kcalFromMacro(event.batteryTypeId, event.amount);
    if (kcal > 0) {
      const ei = updated.findIndex((r) => r.batteryTypeId === 'energy');
      if (ei !== -1) {
        const burned = burnEnergy(updated[ei], kcal);
        updated[ei] = {
          ...burned,
          satietyReserveKcal: Math.max(0, (burned.satietyReserveKcal ?? 0) - kcal),
        };
        toPersist.push(updated[ei]);
      }
    }

    set({
      readings: updated,
      masterPercentage: energyPercentage(updated),
      intakeLog: intakeLog.filter((e) => e.id !== id),
    });

    try {
      await upsertReadings(toPersist);
      await deleteIntakeEventsByIds([id]);
    } catch (e) {
      console.warn('removeIntake persistence failed:', e);
    }
  },

  // Log activity (steps and/or workout sessions) as its own independent,
  // editable/undoable record (B2). Grows today's energy goal (S-M: moving
  // more means more room to eat, it does not touch eaten level) and — the B2
  // fix — actually charges the "Vận động" (movement) battery by `steps`,
  // which was previously never fed and stayed stuck at 0%. `startAt`/`endAt`
  // are stored for history/Excel display only; the battery effect below is
  // applied once, now, at log time (no replay engine — see B2 decision).
  logActivity: async ({ steps = 0, workouts = [], startAt, endAt }, timestampOverride) => {
    const { readings, activityLog } = get();
    const ei = readings.findIndex((r) => r.batteryTypeId === 'energy');
    const mi = readings.findIndex((r) => r.batteryTypeId === 'movement');
    if (ei === -1) return;

    const profile = currentProfile();
    const updated = [...readings];
    updated[ei] = growGoalFromActivity(updated[ei], profile, steps, workouts);
    // A workout also drains the satiety reserve in one lump (training makes
    // you hungrier). Steps don't — the ambient step average is already part
    // of the circadian passive burn.
    const workoutBurn = totalWorkoutKcal(workouts, profile.weightKg);
    if (workoutBurn > 0) {
      updated[ei] = {
        ...updated[ei],
        satietyReserveKcal: drainFromWorkout(updated[ei].satietyReserveKcal ?? 0, workoutBurn),
      };
    }
    // FIX (B2): steps must charge the movement pin itself, same as any other
    // sub-battery intake. Kept in the pin's own unit (steps), not kcal.
    if (mi !== -1 && steps > 0) {
      updated[mi] = applyIntake(updated[mi], steps);
    }

    const toPersist: BatteryReading[] =
      mi !== -1 && steps > 0 ? [updated[ei], updated[mi]] : [updated[ei]];

    // FIX #6: use the caller's original log time when re-logging a patched
    // entry (updateActivity), instead of always stamping "now" — otherwise
    // editing an old activity would bump its timestamp and jump it to the
    // end of the list.
    const ts = timestampOverride ?? nowTimestamp();
    const entry: ActivityLogEntry = {
      id: `activity_${ts}_${Math.round(Math.random() * 1e6)}`,
      timestamp: ts,
      startAt,
      endAt,
      steps,
      workouts,
      energyKcal: stepsKcal(steps, profile.weightKg) + workoutBurn,
      satietyDrainKcal: workoutBurn,
      // FIX #5: snapshot which energy-day's reading actually received the
      // capacity/satiety effect above, so removeActivity can reverse it on
      // the right day even if it's no longer "today" by the time of undo.
      energyDayApplied: energyDayString(new Date(ts)),
    };

    // FIX #6: keep activityLog sorted by timestamp so a re-logged (edited)
    // entry lands back in its original chronological position instead of
    // always appearing last.
    const nextActivityLog = [...activityLog, entry].sort((a, b) => a.timestamp - b.timestamp);

    set({
      readings: updated,
      masterPercentage: energyPercentage(updated),
      activityLog: nextActivityLog,
    });

    try {
      await upsertReadings(toPersist);
      await addActivityLogEntry(entry);

      // Also record into intake_events history so it keeps showing up in the
      // weekly/monthly Excel export (unchanged from before B2 — the battery
      // effects themselves come from the readings/activity_log writes above,
      // not from this event log).
      if (steps > 0) {
        await addIntakeEvent({
          id: `movement_${ts}`,
          timestamp: ts,
          batteryTypeId: 'movement',
          amount: steps,
          note: 'steps',
        });
      }
      for (let i = 0; i < workouts.length; i++) {
        const session = workouts[i];
        const kcal = workoutKcal(session, profile.weightKg);
        await addIntakeEvent({
          id: `workout_${ts}_${i}`,
          timestamp: ts,
          batteryTypeId: 'energy',
          amount: kcal,
          note: `workout: ${session.type} ${session.minutes}m`,
        });
      }
    } catch (e) {
      console.warn('logActivity persistence failed:', e);
    }
  },

  // Undo a logged activity (B2): reverse its effect on the energy goal
  // (capacity/activityBonusKcal), restore the satiety reserve it drained, and
  // reverse the movement pin charge — the exact mirror of removeFood, using
  // the entry's own snapshot (energyKcal/satietyDrainKcal/steps) rather than
  // recomputing from the current profile, so it stays correct even if the
  // profile changed since the entry was logged.
  removeActivity: async (id) => {
    const { readings, activityLog } = get();
    const entry = activityLog.find((a) => a.id === id);
    if (!entry) return;

    // FIX #2+#3: the movement pin is fed cumulatively (logActivity does
    // `applyIntake(movement, steps)`, clamped at capacity) but can ALSO be
    // charged directly by a manual tap (addIntake('movement', ...), which
    // never touches activityLog) and drained by tickDrain over time. A naive
    // recompute-from-activityLog-and-SET (the previous "fix") stomps on both
    // of those — it silently discards whatever tickDrain took away and
    // whatever a manual tap added. The correct inverse is a DELTA applied
    // relative to the pin's CURRENT level:
    //   oldClampedTotal = clamp(sum of steps of ALL of today's entries incl. this one)
    //   newClampedTotal = clamp(sum of steps of the REMAINING entries)
    //   delta           = oldClampedTotal - newClampedTotal   (this entry's
    //                     marginal contribution to the clamped total)
    //   newLevel        = clamp(currentLevel - delta)
    // This reduces to a plain subtraction when nothing clamped, but correctly
    // leaves untouched (a) whatever tickDrain already took off since log time
    // and (b) whatever a manual tap added on top — see energyStore.test.ts
    // "FIX #2+#3" cases.
    const movementReading = readings.find((r) => r.batteryTypeId === 'movement');
    let movementDelta = 0;
    if (movementReading) {
      const totalStepsAll = activityLog.reduce((sum, a) => sum + (a.steps ?? 0), 0);
      const totalStepsRemaining = activityLog
        .filter((a) => a.id !== id)
        .reduce((sum, a) => sum + (a.steps ?? 0), 0);
      const oldClampedTotal = clampLevel(totalStepsAll, movementReading.capacity);
      const newClampedTotal = clampLevel(totalStepsRemaining, movementReading.capacity);
      movementDelta = oldClampedTotal - newClampedTotal;
    }

    // FIX #5: the entry's battery effect on the energy reading was applied,
    // at log time, to the reading for `entry.energyDayApplied` (the 6am-reset
    // energy day) — NOT necessarily the energy-day currently loaded in the
    // store (that only matches if this entry wasn't logged between midnight
    // and 6am and then edited/removed after 6am). Reverse it on the correct
    // reading: if it's today's energy-day, reverse it in-place on `readings`
    // (the pre-existing behavior); otherwise leave `readings` alone entirely
    // and reverse+persist the historical row separately below.
    const currentEnergyDay = energyDayString();
    const sameEnergyDay = entry.energyDayApplied === currentEnergyDay;

    const updated = readings.map((r) => {
      if (r.batteryTypeId === 'energy') {
        if (!sameEnergyDay) return r;
        return reverseActivityOnEnergyReading(r, entry);
      }
      if (r.batteryTypeId === 'movement') {
        return { ...r, level: clampLevel(r.level - movementDelta, r.capacity) };
      }
      return r;
    });

    set({
      readings: updated,
      masterPercentage: energyPercentage(updated),
      activityLog: activityLog.filter((a) => a.id !== id),
    });

    try {
      await upsertReadings(updated.filter((r) => r.batteryTypeId !== 'master'));
      await deleteActivityLogEntry(id);

      // FIX #4: logActivity also wrote intake_events rows (for the Excel
      // export) under deterministic ids derived from this entry's own
      // timestamp — clean those up too, or an edited/undone activity keeps
      // showing up (and can double-count) in the export.
      const intakeEventIds: string[] = [];
      if (entry.steps > 0) intakeEventIds.push(`movement_${entry.timestamp}`);
      entry.workouts.forEach((_, i) => intakeEventIds.push(`workout_${entry.timestamp}_${i}`));
      await deleteIntakeEventsByIds(intakeEventIds);

      if (!sameEnergyDay) {
        // Historical energy-day: fetch, reverse, and persist that day's row
        // on its own — `readings` (today's state) must NOT be touched.
        const historicalRows = await getReadingsForDate(entry.energyDayApplied);
        const historicalEnergy = historicalRows.find((r) => r.batteryTypeId === 'energy');
        if (historicalEnergy) {
          await upsertReadings([reverseActivityOnEnergyReading(historicalEnergy, entry)]);
        }
      }
    } catch (e) {
      console.warn('removeActivity persistence failed:', e);
    }
  },

  // Edit a logged activity (B2). Simplest-and-safest approach: fully reverse
  // the old entry (removeActivity) then log a fresh one (logActivity) with
  // the patch applied on top of the old values — trades keeping the same id
  // (an in-place UPDATE would need to re-derive+undo the OLD goal/satiety
  // delta anyway before applying the new one, which is exactly what
  // remove+re-add already does) for a much smaller, harder-to-get-wrong
  // implementation.
  updateActivity: async (id, patch) => {
    const entry = get().activityLog.find((a) => a.id === id);
    if (!entry) return;

    // FIX #6: capture the entry's ORIGINAL log timestamp before it's removed,
    // so the re-logged entry below can be stamped with it instead of "now" —
    // otherwise editing an old activity would bump its timestamp and reorder
    // it to the end of the list.
    const originalTimestamp = entry.timestamp;

    await get().removeActivity(id);
    await get().logActivity(
      {
        steps: patch.steps ?? entry.steps,
        workouts: patch.workouts ?? entry.workouts,
        // FIX #8 prep: `undefined` in the patch means "field absent, keep the
        // entry's current value"; `null` means "user explicitly cleared this
        // field" and must wipe it back to `undefined` rather than falling
        // back to the old value. `patch.startAt ?? undefined` collapses a
        // `null` patch value to `undefined` (clearing it); when the patch key
        // is `undefined` outright, the first branch keeps `entry.startAt`.
        startAt: patch.startAt === undefined ? entry.startAt : (patch.startAt ?? undefined),
        endAt: patch.endAt === undefined ? entry.endAt : (patch.endAt ?? undefined),
      },
      originalTimestamp
    );
  },

  tickDrain: async (elapsedHours, modeId) => {
    const { readings } = get();
    const mode = getModeById(modeId);

    const profile = currentProfile();
    const nowMs = Date.now();
    const fromMs = nowMs - elapsedHours * 3_600_000;
    // Nutrient batteries are keyed by calendar day; if this tick spans
    // midnight, only drain the portion before the boundary so the extra
    // minutes don't get persisted onto yesterday's stored reading (see
    // clampElapsedHoursAtMidnight for the full rationale). The energy/satiety
    // reserve below is unaffected -- it already drains from an explicit
    // fromMs/toMs anchor and is continuous across day boundaries by design.
    const nutrientElapsedHours = clampElapsedHoursAtMidnight(fromMs, nowMs);
    const updated = readings.map((r) => {
      if (r.batteryTypeId === 'master') return r;
      // Energy battery: the ledger (level/capacity) never drains over time
      // (S-M) — but the satiety reserve does, from its persisted anchor (S-Q).
      if (r.batteryTypeId === 'energy') return syncSatietyReserve(r, profile, nowMs);
      return applyDrain(r, nutrientElapsedHours, mode.drainRatePerHour);
    });

    set({
      readings: updated,
      masterPercentage: energyPercentage(updated),
      lastDrainSyncAt: Date.now(),
    });

    try {
      await upsertReadings(updated.filter((r) => r.batteryTypeId !== 'master'));
    } catch (e) {
      console.warn('tickDrain persistence failed:', e);
    }
  },

  resetForNewDay: async (modeId) => {
    const today = todayString();
    // The satiety reserve is continuous — a new day resets the ledger and
    // the nutrients, never the reserve.
    const prevEnergy = get().readings.find((r) => r.batteryTypeId === 'energy');
    const readings = mapEnergy(buildDefaultReadings(today, modeId), (r) => ({
      ...r,
      satietyReserveKcal: prevEnergy?.satietyReserveKcal ?? 0,
      lastSatietySyncAt: prevEnergy?.lastSatietySyncAt ?? Date.now(),
    }));

    set({
      readings,
      masterPercentage: energyPercentage(readings),
      foodLog: [],
      activityLog: [],
      intakeLog: [],
      lastDrainSyncAt: Date.now(),
    });

    try {
      await upsertReadings(readings);
      await upsertDailyLog({ date: today, modeId });
    } catch (e) {
      console.warn('resetForNewDay persistence failed:', e);
    }
  },
}));

// Convenience selector
export function selectBatteryPercentage(readings: BatteryReading[], id: BatteryId): number {
  const r = readings.find((x) => x.batteryTypeId === id);
  return r ? toPercentage(r.level, r.capacity) : 0;
}
