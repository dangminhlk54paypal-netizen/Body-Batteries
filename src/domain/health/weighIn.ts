import { dateString } from '../../lib/dateUtils';
import { PROFILE_LIMITS } from '../../lib/metabolicConstants';

// When a weigh-in typed FOR a given day is stored: right now for today (as
// before), 07:00 of an earlier day — a morning weigh-in, the usual habit, and
// safely inside that calendar day. Never later than now. Pure: `now` is a
// parameter.
export function weighInTimestamp(date: string, now: number): number {
  if (date === dateString(new Date(now))) return now;
  return Math.min(new Date(`${date}T07:00:00`).getTime(), now);
}

// A body weight the app accepts anywhere (same range as the profile).
export function isValidBodyWeight(kg: number): boolean {
  return Number.isFinite(kg) && kg >= PROFILE_LIMITS.weightKg.min && kg <= PROFILE_LIMITS.weightKg.max;
}
