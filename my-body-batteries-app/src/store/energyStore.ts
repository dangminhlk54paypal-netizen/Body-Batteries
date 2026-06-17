import { create } from 'zustand';
import type { BatteryReading, IntakeEvent, BatteryId } from '../types/battery';
import {
  applyIntake,
  applyDrain,
  computeMasterLevel,
  createDailyReading,
  toPercentage,
} from '../domain/battery/batteryEngine';
import { getModeById } from '../domain/modes/modeDefinitions';
import { checkLowBattery } from '../domain/rules/lowBatteryRules';
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
  addIntake: (batteryId: BatteryId, amount: number, note?: string) => Promise<void>;
  tickDrain: (elapsedHours: number) => Promise<void>;
  resetForNewDay: (modeId: ModeId) => Promise<void>;
}

export const useEnergyStore = create<EnergyState>((set, get) => ({
  readings: [],
  masterPercentage: 0,
  isLoaded: false,

  loadToday: async (modeId) => {
    const today = todayString();
    const mode = getModeById(modeId);

    let readings = await getReadingsForDate(today);

    // First launch of the day: create fresh readings
    if (readings.length === 0) {
      readings = DEFAULT_BATTERIES.filter((b) => b.isActive && b.id !== 'master').map((b) =>
        createDailyReading(today, b.id as BatteryId, mode, 0)
      );
      await upsertReadings(readings);
      await upsertDailyLog({ date: today, modeId });
    }

    const masterPercentage = computeMasterLevel(readings);
    set({ readings, masterPercentage, isLoaded: true });
  },

  addIntake: async (batteryId, amount, note = '') => {
    const { readings } = get();
    const today = todayString();

    const idx = readings.findIndex((r) => r.batteryTypeId === batteryId);
    if (idx === -1) return;

    const updated = [...readings];
    updated[idx] = applyIntake(updated[idx], amount);

    const event: IntakeEvent = {
      id: `${batteryId}_${nowTimestamp()}`,
      timestamp: nowTimestamp(),
      batteryTypeId: batteryId,
      amount,
      note,
    };

    await addIntakeEvent(event);
    await upsertReadings([updated[idx]]);

    const masterPercentage = computeMasterLevel(updated);
    set({ readings: updated, masterPercentage });

    // Return alerts so the caller can trigger notifications
    return checkLowBattery(updated) as any;
  },

  tickDrain: async (elapsedHours) => {
    const { readings } = get();
    const modeId = 'maintain'; // caller should get from settingsStore
    const mode = getModeById(modeId);

    const updated = readings.map((r) =>
      r.batteryTypeId === 'master'
        ? r
        : applyDrain(r, elapsedHours, mode.drainRatePerHour)
    );

    await upsertReadings(updated.filter((r) => r.batteryTypeId !== 'master'));
    const masterPercentage = computeMasterLevel(updated);
    set({ readings: updated, masterPercentage });
  },

  resetForNewDay: async (modeId) => {
    const today = todayString();
    const mode = getModeById(modeId);

    const readings = DEFAULT_BATTERIES.filter((b) => b.isActive && b.id !== 'master').map((b) =>
      createDailyReading(today, b.id as BatteryId, mode, 0)
    );

    await upsertReadings(readings);
    await upsertDailyLog({ date: today, modeId });

    const masterPercentage = computeMasterLevel(readings);
    set({ readings, masterPercentage });
  },
}));

// Convenience selector
export function selectBatteryPercentage(readings: BatteryReading[], id: BatteryId): number {
  const r = readings.find((x) => x.batteryTypeId === id);
  return r ? toPercentage(r.level, r.capacity) : 0;
}
