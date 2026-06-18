import { create } from 'zustand';
import type { BatteryReading, IntakeEvent, BatteryId } from '../types/battery';
import {
  applyIntake,
  applyDrain,
  capacityForMode,
  clampLevel,
  computeMasterLevel,
  createDailyReading,
  toPercentage,
} from '../domain/battery/batteryEngine';
import { getModeById } from '../domain/modes/modeDefinitions';
import { checkLowBattery, type BatteryAlert } from '../domain/rules/lowBatteryRules';
import {
  getReadingsForDate,
  upsertReadings,
} from '../data/repositories/batteryRepository';
import { addIntakeEvent } from '../data/repositories/intakeRepository';
import { upsertDailyLog } from '../data/repositories/dailyLogRepository';
import { todayString, nowTimestamp } from '../lib/dateUtils';
import { DEFAULT_BATTERIES } from '../lib/constants';
import type { ModeId } from '../types/modes';

interface EnergyState {
  readings: BatteryReading[];
  masterPercentage: number;
  isLoaded: boolean;

  loadToday: (modeId: ModeId) => Promise<void>;
  addIntake: (batteryId: BatteryId, amount: number, note?: string) => Promise<BatteryAlert[]>;
  tickDrain: (elapsedHours: number, modeId: ModeId) => Promise<void>;
  resetForNewDay: (modeId: ModeId) => Promise<void>;
}

// Build the default set of readings for a day in memory (no persistence).
function buildDefaultReadings(date: string, modeId: ModeId): BatteryReading[] {
  const mode = getModeById(modeId);
  return DEFAULT_BATTERIES.filter((b) => b.isActive && b.id !== 'master').map((b) =>
    createDailyReading(date, b.id as BatteryId, mode, 0)
  );
}

export const useEnergyStore = create<EnergyState>((set, get) => ({
  readings: [],
  masterPercentage: 0,
  isLoaded: false,

  loadToday: async (modeId) => {
    const today = todayString();
    const mode = getModeById(modeId);

    try {
      let readings = await getReadingsForDate(today);

      if (readings.length === 0) {
        // First launch of the day: create fresh readings for this mode.
        readings = buildDefaultReadings(today, modeId);
      } else {
        // Day already exists: re-apply the current mode's capacities so that
        // switching mode updates today's targets (level is kept, re-clamped).
        readings = readings.map((r) => {
          const capacity = capacityForMode(r.batteryTypeId, mode);
          return { ...r, capacity, level: clampLevel(r.level, capacity) };
        });
      }

      await upsertReadings(readings);
      await upsertDailyLog({ date: today, modeId });

      const masterPercentage = computeMasterLevel(readings);
      set({ readings, masterPercentage, isLoaded: true });
    } catch (e) {
      // Storage unavailable (e.g. SQLite-less web build). Render in-memory
      // defaults so the screen never goes blank.
      console.warn('loadToday failed, using in-memory defaults:', e);
      const readings = buildDefaultReadings(today, modeId);
      set({ readings, masterPercentage: computeMasterLevel(readings), isLoaded: true });
    }
  },

  addIntake: async (batteryId, amount, note = '') => {
    const { readings } = get();

    const idx = readings.findIndex((r) => r.batteryTypeId === batteryId);
    if (idx === -1) return [];

    const updated = [...readings];
    updated[idx] = applyIntake(updated[idx], amount);

    // Update the UI immediately (optimistic) so the cell fills without waiting
    // on storage — this also keeps the alert check below on fresh data.
    const masterPercentage = computeMasterLevel(updated);
    set({ readings: updated, masterPercentage });

    // Persist as best-effort; failures (e.g. web) must not break the UI.
    try {
      const ts = nowTimestamp();
      const event: IntakeEvent = {
        id: `${batteryId}_${ts}`,
        timestamp: ts,
        batteryTypeId: batteryId,
        amount,
        note,
      };
      await addIntakeEvent(event);
      await upsertReadings([updated[idx]]);
    } catch (e) {
      console.warn('addIntake persistence failed:', e);
    }

    return checkLowBattery(updated);
  },

  tickDrain: async (elapsedHours, modeId) => {
    const { readings } = get();
    const mode = getModeById(modeId);

    const updated = readings.map((r) =>
      r.batteryTypeId === 'master'
        ? r
        : applyDrain(r, elapsedHours, mode.drainRatePerHour)
    );

    const masterPercentage = computeMasterLevel(updated);
    set({ readings: updated, masterPercentage });

    try {
      await upsertReadings(updated.filter((r) => r.batteryTypeId !== 'master'));
    } catch (e) {
      console.warn('tickDrain persistence failed:', e);
    }
  },

  resetForNewDay: async (modeId) => {
    const today = todayString();
    const readings = buildDefaultReadings(today, modeId);

    const masterPercentage = computeMasterLevel(readings);
    set({ readings, masterPercentage });

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
