import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActivityDraft } from '../domain/energy/activityDraft';

// The half-filled activity sheet, kept on the device so an accidental close
// (or the app being killed) doesn't lose it. `savedAt` = last edit; the sheet
// only restores a draft younger than DRAFT_TTL_MS (domain/energy/activityDraft.ts).
interface ActivityDraftState {
  draft: ActivityDraft | null;
  savedAt: number;
  // `now` defaults to the clock here, so components never read it in render.
  save: (draft: ActivityDraft, now?: number) => void;
  clear: () => void;
}

export const useActivityDraftStore = create<ActivityDraftState>()(
  persist(
    (set) => ({
      draft: null,
      savedAt: 0,
      save: (draft, now = Date.now()) => set({ draft, savedAt: now }),
      clear: () => set({ draft: null, savedAt: 0 }),
    }),
    { name: 'activity-draft-storage', storage: createJSONStorage(() => AsyncStorage) }
  )
);
