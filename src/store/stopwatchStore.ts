import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  INITIAL_STOPWATCH,
  start,
  stop,
  lap,
  type StopwatchState,
} from '../domain/stopwatch/stopwatch';

interface StopwatchStore extends StopwatchState {
  start: () => void;
  stop: () => void;
  lap: () => void;
  reset: () => void;
}

// Persisted so a running stopwatch survives the app being closed, like the
// iPhone Clock app.
export const useStopwatchStore = create<StopwatchStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_STOPWATCH,
      start: () => set(start(get(), Date.now())),
      stop: () => set(stop(get(), Date.now())),
      lap: () => set(lap(get(), Date.now())),
      reset: () => set(INITIAL_STOPWATCH),
    }),
    {
      name: 'stopwatch-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        startedAt: s.startedAt,
        accumulatedMs: s.accumulatedMs,
        lapMarksMs: s.lapMarksMs,
      }),
    }
  )
);
