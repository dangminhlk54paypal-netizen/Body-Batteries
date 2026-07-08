import {
  PROMINENT_GOAL_IDS,
  MORE_GOAL_IDS,
  LIMIT_IDS,
  ELECTROLYTE_IDS,
  nutrientTargetsForProfile,
} from '../nutrientTargets';
import type { UserProfile } from '../../types/energy';

describe('nutrient display groups', () => {
  it('has no duplicate nutrient id across the display groups', () => {
    const all = [...PROMINENT_GOAL_IDS, ...MORE_GOAL_IDS, ...LIMIT_IDS, ...ELECTROLYTE_IDS];
    const unique = new Set(all);
    expect(unique.size).toBe(all.length);
  });

  it('groups salt with sodium, potassium and magnesium under electrolytes', () => {
    expect(ELECTROLYTE_IDS).toEqual(
      expect.arrayContaining(['salt', 'sodium', 'potassium', 'magnesium'])
    );
    expect(ELECTROLYTE_IDS).toHaveLength(4);
  });

  it('produces a salt target derived from the WHO 5g/day reference', () => {
    const profile: UserProfile = {
      sex: 'male',
      age: 30,
      heightCm: 175,
      weightKg: 70,
      occupation: 'light',
    };
    const targets = nutrientTargetsForProfile(profile);
    const salt = targets.find((t) => t.id === 'salt');
    expect(salt).toBeDefined();
    expect(salt?.kind).toBe('limit');
    expect(salt?.unit).toBe('g');
    expect(salt?.value).toBe(5);
  });
});
