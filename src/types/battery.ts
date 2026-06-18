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
