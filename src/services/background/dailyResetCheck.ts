import { todayString } from '../../lib/dateUtils';

// Pure check: has the calendar day advanced past `lastKnownDate`?
// Returns the new date string if so, or null if the day hasn't changed.
export function checkDateChanged(lastKnownDate: string): string | null {
  const today = todayString();
  return today === lastKnownDate ? null : today;
}
