import { MODES, getModeById } from '../modeDefinitions';

const REQUIRED_BATTERY_KEYS = ['protein', 'carbs', 'water', 'minerals', 'sleep', 'movement'];

describe('MODES', () => {
  it('defines a positive drain rate and all battery multipliers for every mode', () => {
    Object.values(MODES).forEach((mode) => {
      expect(mode.drainRatePerHour).toBeGreaterThan(0);
      REQUIRED_BATTERY_KEYS.forEach((key) => {
        expect(mode.capacityMultipliers[key]).toBeGreaterThan(0);
      });
    });
  });
});

describe('getModeById', () => {
  it('returns the matching mode for a known id', () => {
    expect(getModeById('training')).toBe(MODES.training);
    expect(getModeById('rest')).toBe(MODES.rest);
  });

  it('falls back to "maintain" for an unknown id', () => {
    expect(getModeById('does-not-exist')).toBe(MODES.maintain);
  });

  it('falls back to "maintain" for an empty id', () => {
    expect(getModeById('')).toBe(MODES.maintain);
  });
});
