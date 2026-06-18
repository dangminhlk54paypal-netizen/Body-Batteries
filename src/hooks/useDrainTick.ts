import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useEnergyStore } from '../store/energyStore';
import type { ModeId } from '../types/modes';

// How often to apply foreground drain while the app stays open and active.
const TICK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// Applies battery drain for the time elapsed since the last tick, both on a
// periodic timer (while the app stays in the foreground) and immediately
// when the app returns from the background (to cover the time it was away).
export function useDrainTick(modeId: ModeId, enabled: boolean): void {
  const tickDrain = useEnergyStore((s) => s.tickDrain);
  const modeRef = useRef(modeId);
  const lastTickRef = useRef(Date.now());

  useEffect(() => {
    modeRef.current = modeId;
  }, [modeId]);

  useEffect(() => {
    if (!enabled) return;

    const applyElapsedDrain = () => {
      const now = Date.now();
      const elapsedHours = (now - lastTickRef.current) / 3_600_000;
      lastTickRef.current = now;
      if (elapsedHours > 0) {
        tickDrain(elapsedHours, modeRef.current).catch((e) =>
          console.warn('useDrainTick: tickDrain failed', e)
        );
      }
    };

    lastTickRef.current = Date.now();
    const interval = setInterval(applyElapsedDrain, TICK_INTERVAL_MS);

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        applyElapsedDrain();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled, tickDrain]);
}
