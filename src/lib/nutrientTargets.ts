import type { Sex, UserProfile } from '../types/energy';
import type { MicronutrientId, NutrientKind, NutrientTarget } from '../types/nutrition';

// --- v1 GENERAL reference marks ---------------------------------------------
// Rounded adult DRI/AI values (IOM/NASEM) and WHO sodium/sugar guidance, split
// by sex and a simplified two-bracket adult age split (19–50 / 51+). These are
// population-average reference points, NOT a personal prescription (see
// .ai/CONTEXT.md section 5) — every screen showing them must say "Chỉ để tham
// khảo." Fat/sugar targets are rough %-of-energy estimates for an average
// adult, not tied to this person's real TDEE in v1.

type AgeBracket = 'young' | 'older'; // 19–50 vs 51+

function ageBracket(age: number): AgeBracket {
  return age >= 51 ? 'older' : 'young';
}

interface NutrientMeta {
  id: MicronutrientId;
  kind: NutrientKind;
  nameVi: string;
  unit: 'g' | 'mg';
  color: string;
  male: Record<AgeBracket, number>;
  female: Record<AgeBracket, number>;
}

const NUTRIENT_TABLE: NutrientMeta[] = [
  {
    id: 'fiber',
    kind: 'goal',
    nameVi: 'Chất xơ',
    unit: 'g',
    color: '#00B894',
    male: { young: 38, older: 30 },
    female: { young: 25, older: 21 },
  },
  {
    id: 'iron',
    kind: 'goal',
    nameVi: 'Sắt',
    unit: 'mg',
    color: '#FF6B6B',
    male: { young: 8, older: 8 },
    female: { young: 18, older: 8 },
  },
  {
    id: 'calcium',
    kind: 'goal',
    nameVi: 'Canxi',
    unit: 'mg',
    color: '#4ECDC4',
    male: { young: 1000, older: 1000 },
    female: { young: 1000, older: 1200 },
  },
  {
    id: 'fat',
    kind: 'goal',
    nameVi: 'Chất béo',
    unit: 'g',
    color: '#FFD93D',
    male: { young: 78, older: 78 },
    female: { young: 60, older: 60 },
  },
  {
    id: 'potassium',
    kind: 'goal',
    nameVi: 'Kali',
    unit: 'mg',
    color: '#A29BFE',
    male: { young: 3400, older: 3400 },
    female: { young: 2600, older: 2600 },
  },
  {
    id: 'magnesium',
    kind: 'goal',
    nameVi: 'Magie',
    unit: 'mg',
    color: '#6C5CE7',
    male: { young: 400, older: 420 },
    female: { young: 310, older: 320 },
  },
  {
    id: 'zinc',
    kind: 'goal',
    nameVi: 'Kẽm',
    unit: 'mg',
    color: '#00CEC9',
    male: { young: 11, older: 11 },
    female: { young: 8, older: 8 },
  },
  {
    id: 'sodium',
    kind: 'limit',
    nameVi: 'Natri (muối)',
    unit: 'mg',
    color: '#FF9F43',
    male: { young: 2300, older: 2300 },
    female: { young: 2300, older: 2300 },
  },
  {
    id: 'sugar',
    kind: 'limit',
    nameVi: 'Đường',
    unit: 'g',
    color: '#FD79A8',
    male: { young: 60, older: 60 },
    female: { young: 50, older: 50 },
  },
];

// Curated grouping for the Home UI: a few prominent goal pins shown by
// default, the rest tucked behind "Xem thêm", and limit-type pins in their
// own neutral-labelled row.
export const PROMINENT_GOAL_IDS: MicronutrientId[] = ['fiber', 'iron', 'calcium', 'fat'];
export const MORE_GOAL_IDS: MicronutrientId[] = ['potassium', 'magnesium', 'zinc'];
export const LIMIT_IDS: MicronutrientId[] = ['sodium', 'sugar'];

function valueFor(meta: NutrientMeta, sex: Sex, bracket: AgeBracket): number {
  return sex === 'male' ? meta.male[bracket] : meta.female[bracket];
}

export function nutrientTargetsForProfile(profile: UserProfile): NutrientTarget[] {
  const bracket = ageBracket(profile.age);
  return NUTRIENT_TABLE.map((meta) => ({
    id: meta.id,
    kind: meta.kind,
    nameVi: meta.nameVi,
    unit: meta.unit,
    color: meta.color,
    value: valueFor(meta, profile.sex, bracket),
  }));
}
