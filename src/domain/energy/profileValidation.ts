import type { UserProfile } from '../../types/energy';
import { PROFILE_LIMITS } from '../../lib/metabolicConstants';

// Validates a body profile before it is saved. The Mifflin-St Jeor formula is
// plain algebra — it produces a number for ANY input, so this is the one place
// that keeps that number meaningful for an actual person. Returns a
// user-facing Vietnamese error message, or null when the profile is valid.
export function validateUserProfile(p: UserProfile): string | null {
  const { weightKg, heightCm, age } = PROFILE_LIMITS;

  if (!Number.isFinite(p.weightKg) || p.weightKg < weightKg.min || p.weightKg > weightKg.max) {
    return `Cân nặng phải từ ${weightKg.min} đến ${weightKg.max} kg.`;
  }
  if (!Number.isFinite(p.heightCm) || p.heightCm < heightCm.min || p.heightCm > heightCm.max) {
    return `Chiều cao phải từ ${heightCm.min} đến ${heightCm.max} cm.`;
  }
  if (!Number.isFinite(p.age) || p.age < age.min || p.age > age.max) {
    return `Tuổi phải từ ${age.min} đến ${age.max}.`;
  }
  return null;
}
