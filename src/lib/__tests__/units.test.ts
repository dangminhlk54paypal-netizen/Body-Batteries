import {
  formatWaterAmount,
  toMl,
  nextWaterDisplayUnit,
  formatMovementAmount,
  nextMovementDisplayUnit,
} from '../units';

describe('formatWaterAmount', () => {
  it('formats ml as a rounded integer with an ml suffix', () => {
    expect(formatWaterAmount(1500, 'ml')).toBe('1500ml');
    expect(formatWaterAmount(1499.6, 'ml')).toBe('1500ml');
  });

  it('formats L rounded to 1 decimal with an L suffix', () => {
    expect(formatWaterAmount(1500, 'l')).toBe('1.5L');
    expect(formatWaterAmount(250, 'l')).toBe('0.3L');
    expect(formatWaterAmount(0, 'l')).toBe('0L');
  });
});

describe('toMl', () => {
  it('passes ml through unchanged', () => {
    expect(toMl(500, 'ml')).toBe(500);
  });

  it('converts L to ml', () => {
    expect(toMl(1.5, 'l')).toBe(1500);
  });
});

describe('nextWaterDisplayUnit', () => {
  it('cycles ml -> l -> ml', () => {
    expect(nextWaterDisplayUnit('ml')).toBe('l');
    expect(nextWaterDisplayUnit('l')).toBe('ml');
  });
});

// The kcal figure is caller-computed (HomeScreen passes stepsKcal(...)) —
// this formatter only rounds and suffixes, keeping lib free of domain imports.
describe('formatMovementAmount', () => {
  it("renders the kcal estimate with a ≈ prefix in 'kcal' mode", () => {
    expect(formatMovementAmount(8000, 312, 'kcal')).toBe('≈312 kcal');
    expect(formatMovementAmount(8000, 311.6, 'kcal')).toBe('≈312 kcal');
  });

  it("renders the raw rounded step count in 'steps' mode", () => {
    expect(formatMovementAmount(8000, 312, 'steps')).toBe('8000 bước');
    expect(formatMovementAmount(7999.5, 312, 'steps')).toBe('8000 bước');
  });
});

describe('nextMovementDisplayUnit', () => {
  it('cycles kcal -> steps -> kcal', () => {
    expect(nextMovementDisplayUnit('kcal')).toBe('steps');
    expect(nextMovementDisplayUnit('steps')).toBe('kcal');
  });
});
