export type BatteryId =
  | 'master'
  | 'energy' // calorie-balance battery (Hướng B): charges by eating, drains by metabolism
  | 'protein'
  | 'carbs'
  | 'water'
  | 'minerals'
  | 'sleep'
  | 'movement';

export interface BatteryType {
  id: BatteryId;
  name: string;
  unit: string;
  defaultCapacity: number;
  color: string;
  icon: string;
  isActive: boolean;
}

export interface BatteryReading {
  date: string; // YYYY-MM-DD
  batteryTypeId: BatteryId;
  level: number;      // current amount (e.g. 45g protein)
  capacity: number;   // max for today based on mode
  // Energy battery only (S-M model): kcal added to today's goal from logged
  // steps/workouts, tracked separately so it survives a same-day profile
  // reconcile without losing the activity bonus already earned.
  activityBonusKcal?: number;
  // Energy battery only (S-Q satiety model): the "fullness" kcal reserve the
  // headline battery renders. Continuous — carried across days, never reset,
  // only drained by time/workouts and topped up by eating.
  satietyReserveKcal?: number;
  // Unix ms of the last moment circadian drain was applied to the reserve.
  // Drain is always computed from this persisted anchor (never accumulated
  // from tiny ticks, which would round to 0 kcal and never drain).
  lastSatietySyncAt?: number;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  modeId: ModeId;
}

export interface IntakeEvent {
  id: string;
  timestamp: number; // unix ms
  batteryTypeId: BatteryId;
  amount: number;
  note: string;
}

export interface HealthSignal {
  timestamp: number;
  source: 'watch' | 'phone';
  type: 'steps' | 'heart_rate' | 'sleep' | 'stress';
  value: number;
}

export interface DiaryEntry {
  date: string; // YYYY-MM-DD
  encryptedContent: string;
}

// Derived: what the UI renders per battery
export interface BatteryState {
  type: BatteryType;
  level: number;
  capacity: number;
  percentage: number; // 0–100
}

// Re-export to keep imports clean
import type { ModeId } from './modes';
