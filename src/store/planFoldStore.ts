import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Which block-plan weeks the lifter opened or folded by hand. Remembered on
// the device until a new training week begins (`key` = block id + the current
// week's start): then the new week opens by itself again and older choices
// are dropped. A hand choice always beats the scroll-based folding.
interface PlanFoldState {
  key: string | null;
  weeks: Record<string, boolean>; // weekIndex → open
  setWeek: (key: string, weekIndex: number, open: boolean) => void;
}

export const usePlanFoldStore = create<PlanFoldState>()(
  persist(
    (set) => ({
      key: null,
      weeks: {},
      setWeek: (key, weekIndex, open) =>
        set((s) => ({ key, weeks: { ...(s.key === key ? s.weeks : {}), [weekIndex]: open } })),
    }),
    { name: 'plan-fold-storage', storage: createJSONStorage(() => AsyncStorage) }
  )
);
