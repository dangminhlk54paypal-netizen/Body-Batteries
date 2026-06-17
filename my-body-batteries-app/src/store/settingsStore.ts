import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ModeId } from '../types/modes';

interface SettingsState {
  currentMode: ModeId;
  lowBatteryThreshold: number; // 0.0 – 1.0
  notificationsEnabled: boolean;
  setMode: (mode: ModeId) => void;
  setLowBatteryThreshold: (threshold: number) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currentMode: 'maintain',
      lowBatteryThreshold: 0.2,
      notificationsEnabled: true,

      setMode: (mode) => set({ currentMode: mode }),
      setLowBatteryThreshold: (threshold) => set({ lowBatteryThreshold: threshold }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
