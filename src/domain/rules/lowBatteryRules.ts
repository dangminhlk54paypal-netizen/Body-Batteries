import type { BatteryReading } from '../../types/battery';
import { toPercentage } from '../battery/batteryEngine';
import { LOW_BATTERY_THRESHOLD } from '../../lib/constants';

export interface BatteryAlert {
  batteryTypeId: string;
  percentage: number;
  message: string;
  batteryName: string;
}

// Vietnamese display names for each battery type. Shared by both the alert
// message and the alert title (see notificationService), so it must not be
// duplicated elsewhere.
const BATTERY_DISPLAY_NAMES: Record<string, string> = {
  energy: 'Năng lượng',
  protein: 'Protein',
  carbs: 'Carbs',
  water: 'Nước',
  minerals: 'Khoáng chất',
  sleep: 'Giấc ngủ',
  movement: 'Vận động',
};

export function getBatteryDisplayName(batteryId: string): string {
  return BATTERY_DISPLAY_NAMES[batteryId] ?? batteryId;
}

export function checkLowBattery(
  readings: BatteryReading[],
  threshold: number = LOW_BATTERY_THRESHOLD
): BatteryAlert[] {
  return readings
    .filter((r) => r.batteryTypeId !== 'master')
    .map((r) => ({
      batteryTypeId: r.batteryTypeId,
      percentage: toPercentage(r.level, r.capacity),
    }))
    .filter((r) => r.percentage / 100 < threshold)
    .map((r) => ({
      ...r,
      batteryName: getBatteryDisplayName(r.batteryTypeId),
      message: buildAlertMessage(r.batteryTypeId, r.percentage),
    }));
}

function buildAlertMessage(batteryId: string, pct: number): string {
  const name = getBatteryDisplayName(batteryId);
  return `Pin ${name} còn ${pct}% — hãy nạp thêm ngay!`;
}

// Returns true if any battery is critically low (< 10%)
export function hasCriticalBattery(readings: BatteryReading[]): boolean {
  return readings
    .filter((r) => r.batteryTypeId !== 'master')
    .some((r) => toPercentage(r.level, r.capacity) < 10);
}
