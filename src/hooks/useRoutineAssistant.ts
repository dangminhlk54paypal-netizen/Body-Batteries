import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useEnergyStore } from '../store/energyStore';
import { useRoutineStore } from '../store/routineStore';
import { metricsToAutoFill } from '../domain/routine/routineEngine';
import { todayString } from '../lib/dateUtils';

const HOUR_CHECK_INTERVAL_MS = 60 * 1000;

// The current local hour, re-checked every minute and on returning to the
// foreground, so a check-in appears on the first open inside its window.
function useCurrentHour(): number {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const update = () => setHour(new Date().getHours());
    const interval = setInterval(update, HOUR_CHECK_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);
  return hour;
}

// Mounted once on Home: keeps the insights fresh and runs auto mode. Returns
// the hour for the check-in card.
export function useRoutineAssistant(): number {
  const hour = useCurrentHour();
  const energyLoaded = useEnergyStore((s) => s.isLoaded);
  const readings = useEnergyStore((s) => s.readings);
  const refreshInsights = useRoutineStore((s) => s.refreshInsights);
  const mode = useRoutineStore((s) => s.mode);
  const insights = useRoutineStore((s) => s.insights);
  const insightsLoaded = useRoutineStore((s) => s.insightsLoaded);
  const day = useRoutineStore((s) => s.day);
  const applyAutoFill = useRoutineStore((s) => s.applyAutoFill);
  const running = useRef(false);

  // Anything logged changes `readings`, and so what counts as logged today.
  useEffect(() => {
    if (energyLoaded) refreshInsights();
  }, [energyLoaded, readings, hour, refreshInsights]);

  useEffect(() => {
    if (mode !== 'auto' || !energyLoaded || !insightsLoaded || running.current) return;
    const filled = day.date === todayString() ? day.autoFilled : {};
    const metrics = metricsToAutoFill(insights, hour, filled);
    if (metrics.length === 0) return;
    running.current = true;
    applyAutoFill(metrics.map((m) => ({ metric: m, amount: insights[m].suggested as number }))).finally(() => {
      running.current = false;
    });
  }, [mode, energyLoaded, insightsLoaded, insights, hour, day, applyAutoFill]);

  return hour;
}
