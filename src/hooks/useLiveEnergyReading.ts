import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useEnergyStore } from '../store/energyStore';
import { useSettingsStore } from '../store/settingsStore';
import {
  applyCircadianDrain,
  satietyPercentage,
} from '../domain/energy/satietyEngine';
import { toPercentage } from '../domain/battery/batteryEngine';

export interface LiveEnergyReading {
  // Headline fullness battery (S-Q): drains with the clock, floors at
  // SATIETY_FLOOR_PCT — an empty-ish morning is normal, never an alarm.
  satietyPct: number;
  // Calorie ledger (S-M): eaten / goal, 0–100+ (can exceed 100 past the goal).
  ledgerPct: number;
  levelKcal?: number; // kcal eaten this energy day (6am reset)
  capacityKcal?: number; // today's safe kcal goal
}

// Ticks every second (paused while the app is backgrounded). The store only
// persists the satiety reserve every ~20 minutes (tickDrain); this hook
// re-derives the drained reserve from the persisted anchor on each tick so
// the headline battery visibly creeps down between store writes, without
// writing to the store or DB every second.
export function useLiveEnergyReading(): LiveEnergyReading {
  const energyReading = useEnergyStore((s) => s.readings.find((r) => r.batteryTypeId === 'energy'));
  const profile = useSettingsStore((s) => s.userProfile);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (interval) return;
      interval = setInterval(() => setNow(Date.now()), 1000);
    };
    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    start();
    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        setNow(Date.now());
        start();
      } else {
        stop();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      stop();
      subscription.remove();
    };
  }, []);

  if (!energyReading) return { satietyPct: 0, ledgerPct: 0 };

  const liveReserve = applyCircadianDrain(
    energyReading.satietyReserveKcal ?? 0,
    profile,
    energyReading.lastSatietySyncAt ?? now,
    now
  );

  return {
    satietyPct: satietyPercentage(liveReserve),
    ledgerPct: toPercentage(energyReading.level, energyReading.capacity),
    levelKcal: energyReading.level,
    capacityKcal: energyReading.capacity,
  };
}
