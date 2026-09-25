import { dateString, daysBetween } from '../../lib/dateUtils';
import type { WeightEntryWithId } from './weightHistoryGroups';

// A reading that jumps away from BOTH its neighbours in the same direction —
// 76.0 → 79.5 → 75.8 — is more likely a typo than a real change (body weight
// swings about 1–2 kg day to day, it does not jump 3.5 kg and come back). The
// Weight card marks it so the user can check and fix it; nothing is changed
// automatically. Pure.

// How far a reading must sit from each neighbour to be flagged.
export const OUTLIER_JUMP_KG = 2;
// Neighbours further apart than this could be a real change — no flag.
export const OUTLIER_NEIGHBOUR_DAYS = 10;

export function suspiciousWeightIds(entries: WeightEntryWithId[]): Set<number> {
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  const day = (e: WeightEntryWithId) => dateString(new Date(e.timestamp));
  const flagged = new Set<number>();
  for (let i = 1; i < sorted.length - 1; i++) {
    const [prev, cur, next] = [sorted[i - 1], sorted[i], sorted[i + 1]];
    if (daysBetween(day(prev), day(cur)) > OUTLIER_NEIGHBOUR_DAYS) continue;
    if (daysBetween(day(cur), day(next)) > OUTLIER_NEIGHBOUR_DAYS) continue;
    const up = cur.value - prev.value >= OUTLIER_JUMP_KG && cur.value - next.value >= OUTLIER_JUMP_KG;
    const down = prev.value - cur.value >= OUTLIER_JUMP_KG && next.value - cur.value >= OUTLIER_JUMP_KG;
    if (up || down) flagged.add(cur.id);
  }
  return flagged;
}
