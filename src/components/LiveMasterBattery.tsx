import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { MasterBattery } from './MasterBattery';
import { BodyRecommendationsSheet } from './BodyRecommendationsSheet';
import { useLiveEnergyReading } from '../hooks/useLiveEnergyReading';
import { useSettingsStore } from '../store/settingsStore';
import { dailyCalorieTarget } from '../domain/energy/weightGoal';
import { basalMetabolicRate } from '../domain/energy/metabolismEngine';
import type { UserProfile } from '../types/energy';
import { useT } from '../i18n/useT';
import { LOCALE_TAGS } from '../i18n/types';
import type { Language } from '../i18n/types';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function formatKcal(n: number, language: Language): string {
  return Math.round(n).toLocaleString(LOCALE_TAGS[language]);
}

// Builds the optional goal line under the ledger, e.g.
// "Mục tiêu: giảm về 72 kg (an toàn)". "(an toàn)" is always true — the daily
// target is hard-clamped to a safe pace by dailyCalorieTarget (S-P).
function goalLabelFor(weightKg: number, goalWeightKg: number | undefined, t: TFn): string | undefined {
  if (goalWeightKg === undefined || goalWeightKg === weightKg) return undefined;
  const direction =
    goalWeightKg < weightKg
      ? t('components.masterBattery.directionDown')
      : t('components.masterBattery.directionUp');
  return t('components.masterBattery.goalLine', { direction, weight: goalWeightKg });
}

// Builds the small estimate line under the goal label, e.g.
// "Cần ~1800 kcal/ngày để đạt 65 kg · BMR ~1500" (goal set) or
// "Duy trì cân nặng: ~2100 kcal/ngày · BMR ~1600" (no goal). Pure derivation
// from the profile — no state, no effects (react-hooks/purity safe).
function targetLineFor(profile: UserProfile, t: TFn, language: Language): string {
  const { targetKcal, maintenanceKcal } = dailyCalorieTarget(profile);
  const bmr = basalMetabolicRate(profile);
  if (profile.goalWeightKg !== undefined && profile.goalWeightKg !== profile.weightKg) {
    return t('components.masterBattery.targetLineWithGoal', {
      target: formatKcal(targetKcal, language),
      weight: profile.goalWeightKg,
      bmr: formatKcal(bmr, language),
    });
  }
  return t('components.masterBattery.targetLineMaintain', {
    maintenance: formatKcal(maintenanceKcal, language),
    bmr: formatKcal(bmr, language),
  });
}

// Wraps MasterBattery with the live satiety reading (ticks every second),
// without forcing the rest of HomeScreen to re-render every second. Tapping
// the battery opens BodyRecommendationsSheet (T3) — a read-only "daily
// recommendations" overview derived from the same profile. The sheet's own
// visibility is local state here (not lifted to HomeScreen) since nothing
// else on the screen needs to know about it.
export function LiveMasterBattery() {
  const { satietyPct, levelKcal, capacityKcal, activityBonusKcal } = useLiveEnergyReading();
  const profile = useSettingsStore((s) => s.userProfile);
  const { t, language } = useT();
  const [sheetVisible, setSheetVisible] = useState(false);
  return (
    <>
      <Pressable onPress={() => setSheetVisible(true)}>
        <MasterBattery
          satietyPct={satietyPct}
          levelKcal={levelKcal}
          capacityKcal={capacityKcal}
          goalLabel={goalLabelFor(profile.weightKg, profile.goalWeightKg, t)}
          activityBonusKcal={activityBonusKcal}
          targetLine={targetLineFor(profile, t, language)}
        />
      </Pressable>
      <BodyRecommendationsSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </>
  );
}
