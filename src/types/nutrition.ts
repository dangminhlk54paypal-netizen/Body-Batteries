// Micronutrient battery types (S-R). These are DERIVED, today-only figures
// computed from the food log — no DB table backs them (see
// domain/nutrition/microBatteryEngine.ts).

export type MicronutrientId =
  | 'fiber'
  | 'iron'
  | 'calcium'
  | 'fat'
  | 'potassium'
  | 'magnesium'
  | 'zinc'
  | 'sodium'
  | 'sugar';

// 'goal': eating more is better, up to `value` (empty/under = neutral "still
// room", never shown as a deficiency). 'limit': staying under `value` is the
// aim (going over = neutral "over the suggested cap", never shown as "bad").
export type NutrientKind = 'goal' | 'limit';

export interface NutrientTarget {
  id: MicronutrientId;
  kind: NutrientKind;
  nameVi: string;
  unit: 'g' | 'mg';
  color: string;
  value: number; // goal: daily target to reach; limit: daily cap to stay under
}

export interface MicroBatteryState {
  id: MicronutrientId;
  kind: NutrientKind;
  nameVi: string;
  unit: 'g' | 'mg';
  color: string;
  current: number;
  target: number; // same meaning as NutrientTarget.value
  percentage: number; // 0–100, clamped
  over: boolean; // limit-type only: true when current exceeds target
}
