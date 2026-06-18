import type { BatteryReading } from '../../types/battery';
import { toPercentage } from '../battery/batteryEngine';
import { LOW_BATTERY_THRESHOLD } from '../../lib/constants';

export interface BatteryAlert {
  batteryTypeId: string;
  percentage: number;
  message: string;
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
      message: buildAlertMessage(r.batteryTypeId, r.percentage),
    }));
}

function buildAlertMessage(batteryId: string, pct: number): string {
  const names: Record<string, string> = {
    energy: 'Năng lượng',
    protein: 'Protein',
    carbs: 'Carbs',
    water: 'Nước',
    minerals: 'Khoáng chất',
    sleep: 'Giấc ngủ',
    movement: 'Vận động',
  };
  const name = names[batteryId] ?? batteryId;
  return `Pin ${name} còn ${pct}% — hãy nạp thêm ngay!`;
}

// Returns true if any battery is critically low (< 10%)
export function hasCriticalBattery(readings: BatteryReading[]): boolean {
  return readings
    .filter((r) => r.batteryTypeId !== 'master')
    .some((r) => toPercentage(r.level, r.capacity) < 10);
}
