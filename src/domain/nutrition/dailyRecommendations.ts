import type { UserProfile } from '../../types/energy';
import { dailyCalorieTarget } from '../energy/weightGoal';
import { waterRecommendationMl, sleepRecommendationH } from '../rules/dailyRecommendations';

// Pure "general daily recommendations" overview (T3 — BodyRecommendationsSheet,
// opened by tapping the master battery). This is a SEPARATE reference frame
// from src/lib/nutrientTargets.ts, which drives the existing micronutrient
// sub-batteries (fiber/iron/calcium/...). DO NOT merge the two: they answer
// different questions (today's micro-battery targets vs. a general daily
// overview) and happen to share some source bodies (WHO) by coincidence.
// Every figure below is a population-average reference mark for self-tracking
// only — NOT medical advice (.ai/CONTEXT.md §5, AGENTS.md health boundary).
// This file returns NUMBERS ONLY — no display strings, no i18n lookups; the
// UI (BodyRecommendationsSheet) translates every label/unit via t().

export interface RangeValue {
  min: number;
  max: number;
}

export type HealthyWeightStatus = 'below' | 'within' | 'above';

export interface DailyRecommendations {
  // Calorie target for today, delegated to the existing weight-goal engine —
  // see dailyCalorieTarget (S-P). Not recomputed here.
  calorieTargetKcal: number;
  maintenanceKcal: number;
  // Protein: 0.8–1.6 g/kg current body weight. Lower bound = basic adult RDA;
  // upper bound = commonly cited mark for someone training regularly.
  // Source: IOM/NASEM Dietary Reference Intakes; WHO protein guidance.
  proteinG: RangeValue;
  // Carbohydrates: 45–65% of `calorieTargetKcal`, ÷ 4 kcal/g, rounded to the
  // gram. Source: IOM Acceptable Macronutrient Distribution Range (AMDR).
  carbsG: RangeValue;
  // Free/added sugar: under 10% of energy ÷ 4 kcal/g (the WHO "strong"
  // recommendation ceiling); freeSugarStricterG is the WHO "conditional"
  // further-benefit mark at under 5% of energy. Source: WHO 2015 guideline
  // on sugars intake for adults and children.
  freeSugarLimitG: number;
  freeSugarStricterG: number;
  // Salt: fixed population ceiling, independent of the profile.
  // Source: WHO (5 g/day, ~2000 mg sodium).
  saltLimitG: number;
  // Water: delegated to the existing waterRecommendationMl rules engine (30-40
  // ml/kg, ACSM/EFSA-anchored — see domain/rules/dailyRecommendations.ts) so
  // this sheet always agrees with the water sub-battery target shown
  // elsewhere (HomeScreen/IntakeModal) for the same profile. Computed with
  // hasWorkoutToday=false — this is a general profile-based overview, not a
  // today-specific figure.
  waterMl: RangeValue;
  // Physical activity: fixed population target, independent of the profile —
  // 150–300 minutes/week of moderate-intensity activity, plus resistance
  // training on 2+ days/week (see the "kèm" note rendered by the UI).
  // activityMinutesPerDay is the same range spread evenly over 7 days,
  // rounded. Source: WHO 2020 guidelines on physical activity.
  activityMinutesPerWeek: RangeValue;
  activityMinutesPerDay: RangeValue;
  // Sleep: delegated to the existing sleepRecommendationH rules engine (7–9h
  // for 18–64, narrowing to 7–8h for 65+, with dedicated youth brackets below
  // 18 — see domain/rules/dailyRecommendations.ts) so this sheet always
  // agrees with the age-based recommendation shown elsewhere. Computed with
  // hasWorkoutToday=false, same reasoning as waterMl above.
  // Source: National Sleep Foundation / American Academy of Sleep Medicine.
  sleepHours: RangeValue;
  // Healthy weight range for this height, from the WHO BMI classification
  // (18.5–24.9), plus how the profile's CURRENT weight compares to it.
  healthyWeightKg: RangeValue;
  healthyWeightStatus: HealthyWeightStatus;
}

const PROTEIN_G_PER_KG_MIN = 0.8;
const PROTEIN_G_PER_KG_MAX = 1.6;

const CARBS_ENERGY_PCT_MIN = 0.45;
const CARBS_ENERGY_PCT_MAX = 0.65;
const KCAL_PER_GRAM_CARB = 4;

const FREE_SUGAR_ENERGY_PCT = 0.1; // WHO "strong" recommendation
const FREE_SUGAR_ENERGY_PCT_STRICT = 0.05; // WHO "conditional" further benefit

const SALT_LIMIT_G_PER_DAY = 5;

const ACTIVITY_MIN_PER_WEEK_LOW = 150;
const ACTIVITY_MIN_PER_WEEK_HIGH = 300;
const DAYS_PER_WEEK = 7;

const BMI_HEALTHY_MIN = 18.5;
const BMI_HEALTHY_MAX = 24.9;

function round1Decimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function dailyRecommendations(profile: UserProfile): DailyRecommendations {
  const { targetKcal, maintenanceKcal } = dailyCalorieTarget(profile);

  const proteinG: RangeValue = {
    min: Math.round(PROTEIN_G_PER_KG_MIN * profile.weightKg),
    max: Math.round(PROTEIN_G_PER_KG_MAX * profile.weightKg),
  };

  const carbsG: RangeValue = {
    min: Math.round((CARBS_ENERGY_PCT_MIN * targetKcal) / KCAL_PER_GRAM_CARB),
    max: Math.round((CARBS_ENERGY_PCT_MAX * targetKcal) / KCAL_PER_GRAM_CARB),
  };

  const freeSugarLimitG = Math.round((FREE_SUGAR_ENERGY_PCT * targetKcal) / KCAL_PER_GRAM_CARB);
  const freeSugarStricterG = Math.round(
    (FREE_SUGAR_ENERGY_PCT_STRICT * targetKcal) / KCAL_PER_GRAM_CARB
  );

  const water = waterRecommendationMl(profile, false);
  const waterMl: RangeValue = { min: water.minMl, max: water.maxMl };

  const activityMinutesPerWeek: RangeValue = {
    min: ACTIVITY_MIN_PER_WEEK_LOW,
    max: ACTIVITY_MIN_PER_WEEK_HIGH,
  };
  const activityMinutesPerDay: RangeValue = {
    min: Math.round(ACTIVITY_MIN_PER_WEEK_LOW / DAYS_PER_WEEK),
    max: Math.round(ACTIVITY_MIN_PER_WEEK_HIGH / DAYS_PER_WEEK),
  };

  const sleep = sleepRecommendationH(profile.age, false);
  const sleepHours: RangeValue = { min: sleep.minH, max: sleep.maxH };

  const heightM = profile.heightCm / 100;
  const healthyWeightMinRaw = BMI_HEALTHY_MIN * heightM * heightM;
  const healthyWeightMaxRaw = BMI_HEALTHY_MAX * heightM * heightM;
  const healthyWeightKg: RangeValue = {
    min: round1Decimal(healthyWeightMinRaw),
    max: round1Decimal(healthyWeightMaxRaw),
  };
  // Status is decided against the RAW (unrounded) BMI bounds — comparing
  // against the display-rounded bounds instead could flip the verdict for a
  // profile sitting right at the rounding edge.
  const healthyWeightStatus: HealthyWeightStatus =
    profile.weightKg < healthyWeightMinRaw
      ? 'below'
      : profile.weightKg > healthyWeightMaxRaw
        ? 'above'
        : 'within';

  return {
    calorieTargetKcal: targetKcal,
    maintenanceKcal,
    proteinG,
    carbsG,
    freeSugarLimitG,
    freeSugarStricterG,
    saltLimitG: SALT_LIMIT_G_PER_DAY,
    waterMl,
    activityMinutesPerWeek,
    activityMinutesPerDay,
    sleepHours,
    healthyWeightKg,
    healthyWeightStatus,
  };
}
