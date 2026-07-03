// Safety limits for the weight-goal calorie target (S-P). See
// .ai/parallel-reports/S-O-satiety-battery-spec.md section 1C/6 for the full
// rationale. The applied daily deficit/surplus is capped at the SMALLER of
// MAX_DEFICIT_PCT and MAX_DEFICIT_KCAL, and the resulting target never goes
// below BMR — see domain/energy/weightGoal.ts. This is a self-tracking aid,
// NOT medical advice (see .ai/CONTEXT.md section 5).

export const MAX_DEFICIT_PCT = 0.2; // 20% of maintenance kcal/day
export const MAX_DEFICIT_KCAL = 750; // absolute kcal/day cap

// 1 kg of body fat ≈ 7700 kcal — standard estimate used to convert a weight
// delta into a daily calorie deficit/surplus over the goal timeframe.
export const KCAL_PER_KG_BODY_FAT = 7700;

// Plausible bounds for the optional goal-weight / goal-duration inputs.
// weightKg bound intentionally mirrors PROFILE_LIMITS.weightKg (kept in a
// separate file per S-P's file ownership — see .ai/NEXT_SESSIONS.md).
export const GOAL_WEIGHT_LIMITS = { min: 20, max: 300 };
export const GOAL_WEEKS_LIMITS = { min: 1, max: 104 }; // 1 week .. 2 years
