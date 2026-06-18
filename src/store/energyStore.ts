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
  burnPassive,
  burnActivity,
} from '../domain/energy/energyBalanceEngine';
import { workoutKcal } from '../domain/energy/metabolismEngine';
import { getModeById } from '../domain/modes/modeDefinitions';
import { checkLowBattery, type BatteryAlert } from '../domain/rules/lowBatteryRules';
import {
  getReadingsForDate,
  upsertReadings,
} from '../data/repositories/batteryRepository';
import { addIntakeEvent } from '../data/repositories/intakeRepository';
import { upsertDailyLog } from '../data/repositories/dailyLogRepository';
import { useSettingsStore } from './settingsStore';
import { todayString, nowTimestamp } from '../lib/dateUtils';
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

// The master battery (Hướng B) is the energy battery's percentage. Falls back to
// the nutrient average if no energy reading exists (defensive / old data).
function energyPercentage(readings: BatteryReading[]): number {
  const e = readings.find((r) => r.batteryTypeId === 'energy');
  return e ? toPercentage(e.level, e.capacity) : computeMasterLevel(readings);
}

// Build the default set of readings for a day in memory (no persistence):
// the 6 nutrient batteries + the energy battery sized from the user profile.
function buildDefaultReadings(date: string, modeId: ModeId): BatteryReading[] {
  const mode = getModeById(modeId);
  const nutrients = DEFAULT_BATTERIES.filter(
    (b) => b.isActive && b.id !== 'master' && b.id !== 'energy'
  ).map((b) => createDailyReading(date, b.id as BatteryId, mode, 0));
  return [...nutrients, createEnergyReading(date, currentProfile())];
}

export const useEnergyStore = create<EnergyState>((set, get) => ({
  readings: [],
  masterPercentage: 0,
  foodLog: [],
  lastDrainSyncAt: Date.now(),
  isLoaded: false,

  loadToday: async (modeId) => {
    const today = todayString();
    const mode = getModeById(modeId);
    const profile = currentProfile();

    try {
      let readings = await getReadingsForDate(today);

      if (readings.length === 0) {
        // First launch of the day: create fresh readings for this mode.
        readings = buildDefaultReadings(today, modeId);
      } else {
        // Day already exists: re-apply the current mode capacities (nutrients)
        // and the current profile capacity (energy); keep levels, re-clamped.
        readings = readings.map((r) => {
          if (r.batteryTypeId === 'energy') return reconcileEnergyCapacity(r, profile);
          const capacity = capacityForMode(r.batteryTypeId, mode);
          return { ...r, capacity, level: clampLevel(r.level, capacity) };
        });
        // Backfill the energy battery for days created before Hướng B existed.
        if (!readings.some((r) => r.batteryTypeId === 'energy')) {
          readings = [...readings, createEnergyReading(today, profile)];
        }
      }

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

    // Eating protein/carbs also charges the energy battery (4 kcal/g).
    const kcal = kcalFromMacro(batteryId, amount);
    if (kcal > 0) {
      const ei = updated.findIndex((r) => r.batteryTypeId === 'energy');
      if (ei !== -1) {
        updated[ei] = chargeEnergy(updated[ei], kcal);
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
    // Only alert on the battery just topped up (if it is still low) and the
    // energy battery. The other nutrient batteries start the day empty and fill
    // over time, so checking all of them here would fire a burst of "low" alerts
    // on the very first intake of the day.
    const relevant = updated.filter(
      (r) => r.batteryTypeId === batteryId || r.batteryTypeId === 'energy'
    );
    return checkLowBattery(relevant, lowBatteryThreshold);
  },

  // Manually log eaten calories (the "nhập tay" source).
  addCalories: async (kcal, note = '') => {
    const { readings } = get();
    const ei = readings.findIndex((r) => r.batteryTypeId === 'energy');
    if (ei === -1 || kcal <= 0) return;

    const updated = [...readings];
    updated[ei] = chargeEnergy(updated[ei], kcal);
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
    const mealType = mealTypeForTimestamp(timestamp);

    // Nutrient sub-batteries fed by food (no kcal side-effect — energy is added
    // once below). water_g ≈ ml; minerals is a coarse mg rollup.
    const nutrientCharges: Partial<Record<BatteryId, number>> = {
      protein: n.proteinG,
      carbs: n.carbG,
      water: n.waterG,
      minerals: n.mineralsMg,
    };

    const updated = readings.map((r) => {
      if (r.batteryTypeId === 'energy') return chargeEnergy(r, n.energyKcal);
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
      if (r.batteryTypeId === 'energy') return burnEnergy(r, entry.energyKcal);
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

  // Log activity (steps and/or workout sessions) — drains the energy battery.
  logActivity: async ({ steps = 0, workouts = [] }) => {
    const { readings } = get();
    const ei = readings.findIndex((r) => r.batteryTypeId === 'energy');
    if (ei === -1) return;

    const profile = currentProfile();
    const updated = [...readings];
    updated[ei] = burnActivity(updated[ei], profile, steps, workouts);
    set({ readings: updated, masterPercentage: energyPercentage(updated) });

    try {
      await upsertReadings([updated[ei]]);

      // Record logged activity into intake history so it shows up in the
      // weekly Excel export (it does not affect battery levels here — that
      // already happened above via burnActivity).
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

    const updated = readings.map((r) => {
      if (r.batteryTypeId === 'master') return r;
      // Energy battery drains by real passive metabolism; nutrients by mode rate.
      if (r.batteryTypeId === 'energy') return burnPassive(r, profile, elapsedHours);
      return applyDrain(r, elapsedHours, mode.drainRatePerHour);
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
    const readings = buildDefaultReadings(today, modeId);

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
