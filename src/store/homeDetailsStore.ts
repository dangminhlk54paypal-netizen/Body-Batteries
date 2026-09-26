import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addOpenEvent,
  suggestViewMode,
  SNOOZE_MS,
  type DetailOpenEvent,
  type DetailViewMode,
} from '../domain/habits/detailViewHabit';

// How the user reads Home's "Chi tiết hôm nay": one row at a time (default)
// or up to three together, plus the small open-history the app learns from
// (domain/habits/detailViewHabit.ts). Kept on the device only.
interface HomeDetailsState {
  mode: DetailViewMode;
  log: DetailOpenEvent[];
  snoozedUntil: number;
  // A pending "switch view?" suggestion, computed when a row opens (never
  // during render, so no clock reads there).
  suggestion: DetailViewMode | null;
  // `now` defaults to the clock here, so screens never read it themselves.
  recordOpen: (id: string, openCount: number, now?: number) => void;
  setMode: (mode: DetailViewMode) => void;
  dismissSuggestion: (now?: number) => void;
}

export const useHomeDetailsStore = create<HomeDetailsState>()(
  persist(
    (set) => ({
      mode: 'single',
      log: [],
      snoozedUntil: 0,
      suggestion: null,
      recordOpen: (id, openCount, now = Date.now()) =>
        set((s) => {
          const log = addOpenEvent(s.log, { id, at: now, mode: s.mode, openCount });
          return { log, suggestion: suggestViewMode(log, s.mode, now, s.snoozedUntil) };
        }),
      // A hand choice: switch and start learning afresh in the new mode.
      setMode: (mode) => set({ mode, log: [], suggestion: null }),
      dismissSuggestion: (now = Date.now()) => set({ suggestion: null, snoozedUntil: now + SNOOZE_MS }),
    }),
    { name: 'home-details-storage', storage: createJSONStorage(() => AsyncStorage) }
  )
);
