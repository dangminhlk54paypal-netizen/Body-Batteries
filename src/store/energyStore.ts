import { create } from 'zustand';
import type { BatteryReading, IntakeEvent, BatteryId } from '../types/battery';
import type { WorkoutSession } from '../types/energy';
import type { FoodItem, FoodLogEntry } from '../types/food';
import { nutritionForGrams, mealTypeForTimestamp } from '../domain/food/foodNutrition';
import {
  addFoodLogEntry,
  getFoodLogForDate,
  deleteFoodLogEntry,
} from '../data/repositories/foodLogRepository';
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
import { workoutKcal, totalWorkoutKcal } from '../domain/energy/metabolismEngine';
import { getModeById } from '../domain/modes/modeDefinitions';
import { checkLowBattery, type BatteryAlert } from '../domain/rules/lowBatteryRules';
import {
  getReadingsForDate,
  getLatestEnergyReadingBefore,
  upsertReadings,
} from '../data/repositories/batteryRepository';
import { addIntakeEvent } from '../data/repositories/intakeRepository';
import { upsertDailyLog } from '../data/repositories/dailyLogRepository';
import { useSettingsStore } from './settingsStore';
import { todayString, energyDayString, nowTimestamp } from '../lib/dateUtils';
import { DEFAULT_BATTERIES } from '../lib/constants';
import type { ModeId } from '../types/modes';

interface EnergyState {
  readings: BatteryReading[];
  masterPercentage: number; // Hướng B: this is the ENERGY (calorie-balance) battery %
  foodLog: FoodLogEntry[]; // today's logged meals (for the "Hôm nay đã ăn" view)
  // Timestamp of the last passive-drain tick actually applied to `readings`
  // (loadToday / tickDrain / resetForNewDay). useLiveEnergyReading uses this to
  // extrapolate a smooth per-second display between real ticks, without
  // writing to the store or DB every second.
  lastDrainSyncAt: number;
  isLoaded: boolean;

  loadToday: (modeId: ModeId) => Promise<void>;
  addIntake: (batteryId: BatteryId, amount: number, note?: string) => Promise<BatteryAlert[]>;
  addCalories: (kcal: number, note?: string) => Promise<void>;
  logFood: (item: FoodItem, grams: number, timestamp: number) => Promise<void>;
  removeFood: (id: string) => Promise<void>;
  logActivity: (activity: { steps?: number; workouts?: WorkoutSession[] }) => Promise<void>;
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
  lastDrainSyncAt: Date.now(),
  isLoaded: false,

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

      set({
        readings,
        masterPercentage: energyPercentage(readings),
        foodLog,
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
        lastDrainSyncAt: Date.now(),
        isLoaded: true,
      });
    }
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

    // Optimistic UI update (master = energy %).
    set({ readings: updated, masterPercentage: energyPercentage(updated) });

    try {
      const ts = nowTimestamp();
      const event: IntakeEvent = { id: `${batteryId}_${ts}`, timestamp: ts, batteryTypeId: batteryId, amount, note };
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
  logFood: async (item, grams, timestamp) => {
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

    const updated = readings.map((r) => {
      if (r.batteryTypeId === 'energy') {
        const burned = burnEnergy(r, entry.energyKcal);
        // Undo on the reserve floors at 0, mirroring how eating capped at
        // full — reversal is approximate around the cap/floor, acceptable
        // for a self-tracking estimate.
        return {
          ...burned,
          satietyReserveKcal: Math.max(0, (burned.satietyReserveKcal ?? 0) - entry.energyKcal),
        };
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
    } catch (e) {
      console.warn('removeFood persistence failed:', e);
    }
  },

  // Log activity (steps and/or workout sessions) — grows today's energy goal
  // (S-M: moving more means more room to eat, it does not touch eaten level).
  logActivity: async ({ steps = 0, workouts = [] }) => {
    const { readings } = get();
    const ei = readings.findIndex((r) => r.batteryTypeId === 'energy');
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
    set({ readings: updated, masterPercentage: energyPercentage(updated) });

    try {
      await upsertReadings([updated[ei]]);

      // Record logged activity into intake history so it shows up in the
      // weekly Excel export (it does not affect the battery here — the goal
      // growth already happened above via growGoalFromActivity).
      const ts = nowTimestamp();
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
