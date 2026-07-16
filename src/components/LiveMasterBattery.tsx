import React from 'react';
import { MasterBattery } from './MasterBattery';
import { useLiveEnergyReading } from '../hooks/useLiveEnergyReading';
import { useSettingsStore } from '../store/settingsStore';
import { dailyCalorieTarget } from '../domain/energy/weightGoal';
import { basalMetabolicRate } from '../domain/energy/metabolismEngine';
import type { UserProfile } from '../types/energy';

function formatKcal(n: number): string {
  return Math.round(n).toLocaleString('vi-VN');
}

// Builds the optional goal line under the ledger, e.g.
// "Mục tiêu: giảm về 72 kg (an toàn)". "(an toàn)" is always true — the daily
// target is hard-clamped to a safe pace by dailyCalorieTarget (S-P).
function goalLabelFor(weightKg: number, goalWeightKg?: number): string | undefined {
  if (goalWeightKg === undefined || goalWeightKg === weightKg) return undefined;
  const direction = goalWeightKg < weightKg ? 'giảm về' : 'tăng lên';
  return `Mục tiêu: ${direction} ${goalWeightKg} kg (an toàn)`;
}

// Builds the small estimate line under the goal label, e.g.
// "Cần ~1800 kcal/ngày để đạt 65 kg · BMR ~1500" (goal set) or
// "Duy trì cân nặng: ~2100 kcal/ngày · BMR ~1600" (no goal). Pure derivation
// from the profile — no state, no effects (react-hooks/purity safe).
function targetLineFor(profile: UserProfile): string {
  const { targetKcal, maintenanceKcal } = dailyCalorieTarget(profile);
  const bmr = basalMetabolicRate(profile);
  if (profile.goalWeightKg !== undefined && profile.goalWeightKg !== profile.weightKg) {
    return `Cần ~${formatKcal(targetKcal)} kcal/ngày để đạt ${profile.goalWeightKg} kg · BMR ~${formatKcal(bmr)}`;
  }
  return `Duy trì cân nặng: ~${formatKcal(maintenanceKcal)} kcal/ngày · BMR ~${formatKcal(bmr)}`;
}

// Wraps MasterBattery with the live satiety reading (ticks every second),
// without forcing the rest of HomeScreen to re-render every second.
export function LiveMasterBattery() {
  const { satietyPct, levelKcal, capacityKcal, activityBonusKcal } = useLiveEnergyReading();
  const profile = useSettingsStore((s) => s.userProfile);
  return (
    <MasterBattery
      satietyPct={satietyPct}
      levelKcal={levelKcal}
      capacityKcal={capacityKcal}
      goalLabel={goalLabelFor(profile.weightKg, profile.goalWeightKg)}
      activityBonusKcal={activityBonusKcal}
      targetLine={targetLineFor(profile)}
    />
  );
}
