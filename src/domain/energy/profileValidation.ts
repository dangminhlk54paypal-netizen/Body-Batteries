import type { UserProfile } from '../../types/energy';
import { PROFILE_LIMITS } from '../../lib/metabolicConstants';
import { GOAL_WEIGHT_LIMITS, GOAL_WEEKS_LIMITS } from '../../lib/weightGoalConstants';

// Validates a body profile before it is saved. The Mifflin-St Jeor formula is
// plain algebra — it produces a number for ANY input, so this is the one place
// that keeps that number meaningful for an actual person. Returns a
// user-facing Vietnamese error message, or null when the profile is valid.
export function validateUserProfile(p: UserProfile): string | null {
  const { weightKg, heightCm, age, averageDailySteps } = PROFILE_LIMITS;

  if (!Number.isFinite(p.weightKg) || p.weightKg < weightKg.min || p.weightKg > weightKg.max) {
    return `Cân nặng phải từ ${weightKg.min} đến ${weightKg.max} kg.`;
  }
  if (!Number.isFinite(p.heightCm) || p.heightCm < heightCm.min || p.heightCm > heightCm.max) {
    return `Chiều cao phải từ ${heightCm.min} đến ${heightCm.max} cm.`;
  }
  if (!Number.isFinite(p.age) || p.age < age.min || p.age > age.max) {
    return `Tuổi phải từ ${age.min} đến ${age.max}.`;
  }
  const steps = p.averageDailySteps ?? 0;
  if (!Number.isFinite(steps) || steps < averageDailySteps.min || steps > averageDailySteps.max) {
    return `Số bước trung bình/ngày phải từ ${averageDailySteps.min} đến ${averageDailySteps.max}.`;
  }
  if (p.goalWeightKg !== undefined) {
    if (
      !Number.isFinite(p.goalWeightKg) ||
      p.goalWeightKg < GOAL_WEIGHT_LIMITS.min ||
      p.goalWeightKg > GOAL_WEIGHT_LIMITS.max
    ) {
      return `Cân nặng mong muốn phải từ ${GOAL_WEIGHT_LIMITS.min} đến ${GOAL_WEIGHT_LIMITS.max} kg.`;
    }
  }
  if (p.goalWeeks !== undefined) {
    if (
      !Number.isFinite(p.goalWeeks) ||
      p.goalWeeks < GOAL_WEEKS_LIMITS.min ||
      p.goalWeeks > GOAL_WEEKS_LIMITS.max
    ) {
      return `Thời gian mong muốn phải từ ${GOAL_WEEKS_LIMITS.min} đến ${GOAL_WEEKS_LIMITS.max} tuần.`;
    }
  }
  return null;
}
