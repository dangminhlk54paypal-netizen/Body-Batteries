import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The half-typed "Nạp bằng chữ" text, kept on the device so an accidental
// close doesn't lose a long dictated meal — same rule as the activity sheet
// (activityDraftStore): restored only while younger than DRAFT_TTL_MS, and
// Huỷ / a successful Nạp clears it. Only the text is kept: the review rows are
// rebuilt from it with one tap, against the food log as it is by then.
interface MealTextDraftState {
  text: string;
  savedAt: number;
  // `now` defaults to the clock here, so components never read it in render.
  save: (text: string, now?: number) => void;
  clear: () => void;
}

export const useMealTextDraftStore = create<MealTextDraftState>()(
  persist(
    (set) => ({
      text: '',
      savedAt: 0,
      save: (text, now = Date.now()) => set({ text, savedAt: now }),
      clear: () => set({ text: '', savedAt: 0 }),
    }),
    { name: 'meal-text-draft-storage', storage: createJSONStorage(() => AsyncStorage) }
  )
);
