import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useEnergyStore } from '../store/energyStore';
import { useSettingsStore } from '../store/settingsStore';
import { burnPassive } from '../domain/energy/energyBalanceEngine';
import { toPercentage } from '../domain/battery/batteryEngine';

export interface LiveEnergyReading {
  percentage: number;
  levelKcal?: number;
  capacityKcal?: number;
}

// Ticks every second (paused while the app is backgrounded) so the energy
// battery visibly drains in real time between the periodic persisted ticks
// in useDrainTick.ts (every 30 min / on resume). This extrapolates from the
// last real tick using the same pure burnPassive used for persistence — it
// never writes to the store or the database, so it can't drift from or
// double-count against the real drain.
export function useLiveEnergyReading(): LiveEnergyReading {
  const energyReading = useEnergyStore((s) => s.readings.find((r) => r.batteryTypeId === 'energy'));
  const lastDrainSyncAt = useEnergyStore((s) => s.lastDrainSyncAt);
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

  if (!energyReading) return { percentage: 0 };

  const elapsedHours = Math.max(0, now - lastDrainSyncAt) / 3_600_000;
  const live = burnPassive(energyReading, profile, elapsedHours);

  return {
    percentage: toPercentage(live.level, live.capacity),
    levelKcal: live.level,
    capacityKcal: live.capacity,
  };
}
