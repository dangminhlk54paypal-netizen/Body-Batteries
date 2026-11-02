// Routine auto-fill: settings + per-day state. Only READS intake history and
// logs through energyStore's normal actions, so every rule of the battery
// model (replay, energy day, goal growth) applies to what it fills.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  analyzeRoutines,
  emptyInsights,
  MAX_LOOKBACK_DAYS,
  type RoutineInsights,
  type RoutineMetric,
  type RoutineMode,
  type RoutineSlot,
} from '../domain/routine/routineEngine';
import { getIntakeEventsInRange } from '../data/repositories/intakeRepository';
import { daysAgo, nowTimestamp, todayString } from '../lib/dateUtils';
import { useEnergyStore } from './energyStore';

interface AutoFilled {
  amount: number; // 0 = undone: stays listed so it isn't filled again today
  at: number;
}

interface DayState {
  date: string;
  handledSlots: Partial<Record<RoutineSlot, boolean>>; // check-in saved or skipped
  autoFilled: Partial<Record<RoutineMetric, AutoFilled>>;
  autoBannerDismissed: boolean;
  optInSnoozed: boolean; // "later" on the opt-in question: asks again tomorrow
}

function freshDay(date: string): DayState {
  return { date, handledSlots: {}, autoFilled: {}, autoBannerDismissed: false, optInSnoozed: false };
}

interface RoutineState {
  mode: RoutineMode;
  optInAnswered: boolean;
  lastBedtime: string | null; // "HH:MM", from the last morning check-in
  lastWakeTime: string | null;
  day: DayState;

  // Runtime only.
  insights: RoutineInsights;
  insightsLoaded: boolean;

  setMode: (mode: RoutineMode) => void;
  snoozeOptIn: () => void;
  refreshInsights: () => Promise<void>;
  markSlotHandled: (slot: RoutineSlot) => void;
  setSleepTimes: (bedtime: string, wakeTime: string) => void;
  logMetric: (metric: RoutineMetric, amount: number, timestamp?: number) => Promise<void>;
  applyAutoFill: (entries: { metric: RoutineMetric; amount: number }[]) => Promise<void>;
  undoAutoFill: () => Promise<void>;
  dismissAutoBanner: () => void;
}

function currentDay(state: RoutineState): DayState {
  const today = todayString();
  return state.day.date === today ? state.day : freshDay(today);
}

export const useRoutineStore = create<RoutineState>()(
  persist(
    (set, get) => ({
      mode: 'off',
      optInAnswered: false,
      lastBedtime: null,
      lastWakeTime: null,
      day: freshDay(todayString()),
      insights: emptyInsights(),
      insightsLoaded: false,

      setMode: (mode) => set({ mode, optInAnswered: true }),
      snoozeOptIn: () => set((s) => ({ day: { ...currentDay(s), optInSnoozed: true } })),

      refreshInsights: async () => {
        try {
          const events = await getIntakeEventsInRange(daysAgo(MAX_LOOKBACK_DAYS), todayString());
          set({ insights: analyzeRoutines(events, todayString()), insightsLoaded: true });
        } catch (e) {
          console.warn('routine refreshInsights failed:', e);
          set({ insights: emptyInsights(), insightsLoaded: true });
        }
      },

      markSlotHandled: (slot) =>
        set((s) => {
          const day = currentDay(s);
          return { day: { ...day, handledSlots: { ...day.handledSlots, [slot]: true } } };
        }),

      setSleepTimes: (bedtime, wakeTime) => set({ lastBedtime: bedtime, lastWakeTime: wakeTime }),

      logMetric: async (metric, amount, timestamp = nowTimestamp()) => {
        if (!(amount > 0)) return;
        const energy = useEnergyStore.getState();
        if (metric === 'walkMinutes') {
          await energy.logActivity({ workouts: [{ type: 'walking', minutes: amount }] }, timestamp);
        } else if (metric === 'steps') {
          await energy.logActivity({ steps: amount }, timestamp);
        } else {
          await energy.addIntake(metric, amount, '', { timestamp });
        }
      },

      applyAutoFill: async (entries) => {
        const filled: Partial<Record<RoutineMetric, AutoFilled>> = {};
        for (const { metric, amount } of entries) {
          if (metric === 'walkMinutes') continue; // only asked about, never filled alone
          const at = nowTimestamp();
          await get().logMetric(metric, amount, at);
          filled[metric] = { amount, at };
        }
        if (Object.keys(filled).length === 0) return;
        set((s) => {
          const day = currentDay(s);
          return { day: { ...day, autoFilled: { ...day.autoFilled, ...filled }, autoBannerDismissed: false } };
        });
        await get().refreshInsights();
      },

      // Removes the very rows auto mode wrote, so nothing is left in the logs.
      undoAutoFill: async () => {
        const day = currentDay(get());
        const energy = useEnergyStore.getState();
        const cleared: Partial<Record<RoutineMetric, AutoFilled>> = {};
        for (const [key, filled] of Object.entries(day.autoFilled)) {
          const metric = key as RoutineMetric;
          cleared[metric] = { amount: 0, at: filled.at };
          if (filled.amount <= 0) continue;
          if (metric === 'steps') {
            const entry = useEnergyStore.getState().activityLog.find((a) => a.timestamp === filled.at);
            if (entry) await energy.removeActivity(entry.id);
          } else {
            await energy.removeIntake(`${metric}_${filled.at}`);
          }
        }
        set({ day: { ...day, autoFilled: cleared, autoBannerDismissed: true } });
        await get().refreshInsights();
      },

      dismissAutoBanner: () => set((s) => ({ day: { ...currentDay(s), autoBannerDismissed: true } })),
    }),
    {
      name: 'routine-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        mode: s.mode,
        optInAnswered: s.optInAnswered,
        lastBedtime: s.lastBedtime,
        lastWakeTime: s.lastWakeTime,
        day: s.day,
      }),
    }
  )
);
