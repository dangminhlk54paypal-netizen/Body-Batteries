import React from 'react';
import { MasterBattery } from './MasterBattery';
import { useLiveEnergyReading } from '../hooks/useLiveEnergyReading';
import { useSettingsStore } from '../store/settingsStore';

// Builds the optional goal line under the ledger, e.g.
// "Mục tiêu: giảm về 72 kg (an toàn)". "(an toàn)" is always true — the daily
// target is hard-clamped to a safe pace by dailyCalorieTarget (S-P).
function goalLabelFor(weightKg: number, goalWeightKg?: number): string | undefined {
  if (goalWeightKg === undefined || goalWeightKg === weightKg) return undefined;
  const direction = goalWeightKg < weightKg ? 'giảm về' : 'tăng lên';
  return `Mục tiêu: ${direction} ${goalWeightKg} kg (an toàn)`;
}

// Wraps MasterBattery with the live satiety reading (ticks every second),
// without forcing the rest of HomeScreen to re-render every second.
export function LiveMasterBattery() {
  const { satietyPct, levelKcal, capacityKcal } = useLiveEnergyReading();
  const profile = useSettingsStore((s) => s.userProfile);
  return (
    <MasterBattery
      satietyPct={satietyPct}
      levelKcal={levelKcal}
      capacityKcal={capacityKcal}
      goalLabel={goalLabelFor(profile.weightKg, profile.goalWeightKg)}
    />
  );
}
