import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useEnergyStore } from '../store/energyStore';
import { useSettingsStore } from '../store/settingsStore';
import { canEatNow } from '../domain/energy/energyBalanceEngine';
import { toPercentage } from '../domain/battery/batteryEngine';

export interface LiveEnergyReading {
  percentage: number; // eaten / goal, 0–100+ (can exceed 100 when eating past the goal)
  levelKcal?: number; // kcal eaten so far today
  capacityKcal?: number; // today's kcal goal
  canEatKcal?: number; // live "còn được ăn ngay" — ticks every second
}

// Ticks every second (paused while the app is backgrounded). Under the S-M
// model the energy battery itself no longer drains over time — level/capacity
// only change when the user eats or logs activity, which already re-renders
// via the store selector below. This tick instead keeps the live "can eat
// now" number moving, reusing the same per-second mechanism Session 5 built
// for the old smooth-drain display (repurposed, not deleted).
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

  if (!energyReading) return { percentage: 0 };

  // 'YYYY-MM-DD' is parsed as local midnight here (consistent with
  // formatDisplayDate in lib/dateUtils.ts) — parsing the bare string would be
  // read as UTC midnight and skew the elapsed-hours count by the timezone offset.
  const midnightMs = new Date(`${energyReading.date}T00:00:00`).getTime();
  const elapsedHoursSinceMidnight = Math.max(0, now - midnightMs) / 3_600_000;

  return {
    percentage: toPercentage(energyReading.level, energyReading.capacity),
    levelKcal: energyReading.level,
    capacityKcal: energyReading.capacity,
    canEatKcal: canEatNow(energyReading, profile, elapsedHoursSinceMidnight),
  };
}
