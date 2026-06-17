import type { BatteryType } from '../types/battery';

export const DEFAULT_BATTERIES: BatteryType[] = [
  {
    id: 'protein',
    name: 'Protein',
    unit: 'g',
    defaultCapacity: 120,
    color: '#FF6B6B',
    icon: 'egg',
    isActive: true,
  },
  {
    id: 'carbs',
    name: 'Carbs',
    unit: 'g',
    defaultCapacity: 250,
    color: '#FFD93D',
    icon: 'grain',
    isActive: true,
  },
  {
    id: 'water',
    name: 'Nước',
    unit: 'ml',
    defaultCapacity: 2500,
    color: '#4ECDC4',
    icon: 'water-drop',
    isActive: true,
  },
  {
    id: 'minerals',
    name: 'Khoáng chất',
    unit: 'mg',
    defaultCapacity: 500,
    color: '#A29BFE',
    icon: 'flash',
    isActive: true,
  },
  {
    id: 'sleep',
    name: 'Giấc ngủ',
    unit: 'h',
    defaultCapacity: 8,
    color: '#6C5CE7',
    icon: 'moon',
    isActive: true,
  },
  {
    id: 'movement',
    name: 'Vận động',
    unit: 'steps',
    defaultCapacity: 8000,
    color: '#00B894',
    icon: 'walk',
    isActive: true,
  },
];

export const LOW_BATTERY_THRESHOLD = 0.2; // 20% — trigger warning below this

export const DATA_RETENTION_DAYS = 7;

export const DRAIN_TICK_INTERVAL_MS = 30 * 60 * 1000; // every 30 min

export const BACKGROUND_TASK_NAME = 'BATTERY_DRAIN_TASK';
export const DAILY_RESET_TASK_NAME = 'DAILY_RESET_TASK';
