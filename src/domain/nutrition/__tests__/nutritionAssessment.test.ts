import { assessState, assessDay, ASSESSMENT_RULES, ASSESSMENT_ORDER } from '../nutritionAssessment';
import { vi } from '../../../i18n/locales/vi';
import type { MicroBatteryState } from '../../../types/nutrition';

function state(overrides: Partial<MicroBatteryState>): MicroBatteryState {
  return {
    id: 'fiber',
    kind: 'goal',
    nameVi: 'Chất xơ',
    unit: 'g',
    color: '#000',
    current: 25,
    target: 25,
    percentage: 100,
    over: false,
    ...overrides,
  };
}

describe('assessState', () => {
  it('returns null when a goal nutrient sits comfortably between thresholds', () => {
    const fiber = state({ id: 'fiber', current: 20, target: 25 }); // 80% — above 70%, below 100%
    expect(assessState(fiber, 'vi')).toBeNull();
  });

  it('returns the gentle "under" advice when a goal nutrient is below its threshold', () => {
    const fiber = state({ id: 'fiber', current: 10, target: 25 }); // 40%
    expect(assessState(fiber, 'vi')).toBe(vi.nutrients.fiber.underAdvice);
  });

  it('does not trigger "under" advice right at the threshold boundary', () => {
    const fiber = state({ id: 'fiber', current: 17.5, target: 25 }); // exactly 70%
    expect(assessState(fiber, 'vi')).toBeNull();
  });

  it('returns the neutral "over" advice when a goal nutrient exceeds its target', () => {
    const iron = state({ id: 'iron', current: 20, target: 8, kind: 'goal' }); // 250%
    expect(assessState(iron, 'vi')).toBe(vi.nutrients.iron.overAdvice);
  });

  it('never returns "under" advice for a limit-type nutrient (no such rule)', () => {
    const sodium = state({ id: 'sodium', kind: 'limit', current: 0, target: 2300 }); // 0%
    expect(assessState(sodium, 'vi')).toBeNull();
  });

  it('returns the gentle "over" advice when a limit-type nutrient exceeds its cap', () => {
    const sodium = state({ id: 'sodium', kind: 'limit', current: 3000, target: 2300 }); // ~130%
    expect(assessState(sodium, 'vi')).toBe(vi.nutrients.sodium.overAdvice);
  });

  it('stays quiet for a limit-type nutrient comfortably under its cap', () => {
    const sugar = state({ id: 'sugar', kind: 'limit', current: 30, target: 60 }); // 50%
    expect(assessState(sugar, 'vi')).toBeNull();
  });

  it('guards against a zero/negative target instead of dividing by zero', () => {
    const broken = state({ id: 'fiber', current: 10, target: 0 });
    expect(assessState(broken, 'vi')).toBeNull();
  });

  it('has a rule (with a source URL) for every nutrient in ASSESSMENT_ORDER', () => {
    for (const id of ASSESSMENT_ORDER) {
      expect(ASSESSMENT_RULES[id]).toBeDefined();
      expect(ASSESSMENT_RULES[id].sourceUrl).toMatch(/^https:\/\//);
    }
  });
});

describe('assessDay', () => {
  it('returns "Ổn 👍" when every nutrient is within its comfortable range', () => {
    const states = [
      state({ id: 'fiber', current: 20, target: 25 }),
      state({ id: 'sodium', kind: 'limit', current: 1000, target: 2300 }),
    ];
    expect(assessDay(states, 'vi')).toBe('Ổn 👍');
  });

  it('returns "Ổn 👍" for an empty list (empty log, no crash)', () => {
    expect(assessDay([], 'vi')).toBe('Ổn 👍');
  });

  it('joins multiple triggered advice lines for the day', () => {
    const states = [
      state({ id: 'fiber', current: 5, target: 25 }), // under
      state({ id: 'sodium', kind: 'limit', current: 3000, target: 2300 }), // over
    ];
    const result = assessDay(states, 'vi');
    expect(result).toContain(vi.nutrients.fiber.underAdvice);
    expect(result).toContain(vi.nutrients.sodium.overAdvice);
  });
});
