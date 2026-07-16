import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ModeId } from '../types/modes';
import type { CustomActivity, UserProfile } from '../types/energy';
import { DEFAULT_MEAL_WINDOWS, type MealWindow } from '../lib/constants';
import type { MovementDisplayUnit, WaterDisplayUnit } from '../lib/units';

// Default body profile (the user's own example values; age/sex are placeholders
// the user can correct in Settings → "Hồ sơ cơ thể"). Used to size the energy
// battery via the metabolism engine.
export const DEFAULT_USER_PROFILE: UserProfile = {
  weightKg: 78,
  heightCm: 168,
  age: 30,
  sex: 'male',
  occupation: 'sedentary',
};

// Meal windows persisted per user. Falls back to DEFAULT_MEAL_WINDOWS when
// not yet customised (e.g. on first launch or after a store reset).
export type MealWindows = Record<'breakfast' | 'lunch' | 'dinner', MealWindow>;

interface SettingsState {
  currentMode: ModeId;
  lowBatteryThreshold: number; // 0.0 – 1.0
  notificationsEnabled: boolean;
  reminderHour: number; // 0–23
  reminderMinute: number; // 0–59
  userProfile: UserProfile;
  hasOnboarded: boolean;
  mealWindows: MealWindows;
  // P7: toggles the "charge particle" burst on MasterBattery (the scale/glow
  // pulse from P4 always stays on — this only gates the extra SVG particles).
  particleEffectsEnabled: boolean;
  // Display-only preference for the water sub-battery cell (ml or L) — the
  // stored/charged amount is always ml, this never affects that (see
  // src/lib/units.ts). Persisted so the choice survives an app restart.
  waterDisplayUnit: WaterDisplayUnit;
  // Display-only preference for the movement/"Vận động" sub-battery cell
  // (kcal or steps) — mirrors waterDisplayUnit's pattern, see src/lib/units.ts.
  movementDisplayUnit: MovementDisplayUnit;
  // Home screen's micronutrient ("vi chất") section collapsed/expanded state.
  microCollapsed: boolean;
  // User-defined activities (not in MET_TABLE) available in the activity
  // picker alongside the built-in ActivityType list — see types/energy.ts.
  customActivities: CustomActivity[];
  setMode: (mode: ModeId) => void;
  setLowBatteryThreshold: (threshold: number) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setReminderTime: (hour: number, minute: number) => void;
  setUserProfile: (profile: UserProfile) => void;
  setHasOnboarded: (value: boolean) => void;
  setMealWindow: (meal: 'breakfast' | 'lunch' | 'dinner', window: MealWindow) => void;
  setParticleEffectsEnabled: (enabled: boolean) => void;
  setWaterDisplayUnit: (unit: WaterDisplayUnit) => void;
  setMovementDisplayUnit: (unit: MovementDisplayUnit) => void;
  setMicroCollapsed: (value: boolean) => void;
  addCustomActivity: (activity: Omit<CustomActivity, 'id'>) => void;
  removeCustomActivity: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currentMode: 'maintain',
      lowBatteryThreshold: 0.2,
      notificationsEnabled: true,
      reminderHour: 20,
      reminderMinute: 0,
      userProfile: DEFAULT_USER_PROFILE,
      hasOnboarded: false,
      mealWindows: DEFAULT_MEAL_WINDOWS,
      particleEffectsEnabled: true,
      waterDisplayUnit: 'ml',
      movementDisplayUnit: 'kcal',
      microCollapsed: false,
      customActivities: [],

      setMode: (mode) => set({ currentMode: mode }),
      setLowBatteryThreshold: (threshold) => set({ lowBatteryThreshold: threshold }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setReminderTime: (hour, minute) => set({ reminderHour: hour, reminderMinute: minute }),
      setUserProfile: (profile) => set({ userProfile: profile }),
      setHasOnboarded: (value) => set({ hasOnboarded: value }),
      setMealWindow: (meal, window) =>
        set((s) => ({ mealWindows: { ...s.mealWindows, [meal]: window } })),
      setParticleEffectsEnabled: (enabled) => set({ particleEffectsEnabled: enabled }),
      setWaterDisplayUnit: (unit) => set({ waterDisplayUnit: unit }),
      setMovementDisplayUnit: (unit) => set({ movementDisplayUnit: unit }),
      setMicroCollapsed: (value) => set({ microCollapsed: value }),
      addCustomActivity: (activity) =>
        set((s) => ({
          customActivities: [...s.customActivities, { ...activity, id: `custom_${Date.now()}` }],
        })),
      removeCustomActivity: (id) =>
        set((s) => ({ customActivities: s.customActivities.filter((a) => a.id !== id) })),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
