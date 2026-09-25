import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useBlockStore } from '../store/blockStore';

// Every 10 minutes while the app stays open, so a session confirmed for 18:00
// shows up in Xả soon after, not only on the next launch.
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

// Logs the block sessions the lifter confirmed once their time has come (see
// domain/energy/blockSessions): on start, on return to the foreground, and on
// a timer — the same triggers useDrainTick uses for battery drain.
export function useBlockSessionAutoLog(enabled: boolean): void {
  const runDueSessions = useBlockStore((s) => s.runDueSessions);

  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      runDueSessions().catch((e) => console.warn('useBlockSessionAutoLog: runDueSessions failed', e));
    };
    run();
    const interval = setInterval(run, CHECK_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') run();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled, runDueSessions]);
}
