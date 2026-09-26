import { bubbleInfluence, tabCenterX, tabIndexAt } from '../bubbleWave';

describe('bubbleInfluence', () => {
  it('is 1 under the finger and falls off smoothly and symmetrically', () => {
    expect(bubbleInfluence(0, 80)).toBe(1);
    const near = bubbleInfluence(40, 80);
    const far = bubbleInfluence(160, 80);
    expect(near).toBeLessThan(1);
    expect(far).toBeLessThan(near);
    expect(far).toBeGreaterThan(0);
    expect(bubbleInfluence(240, 80)).toBeLessThan(0.02);
  });

  it('is 0 when the bar has no size yet', () => {
    expect(bubbleInfluence(0, 0)).toBe(0);
  });
});

describe('tabIndexAt', () => {
  it('maps x to the tab under it and clamps outside the bar', () => {
    expect(tabIndexAt(10, 400, 5)).toBe(0);
    expect(tabIndexAt(200, 400, 5)).toBe(2);
    expect(tabIndexAt(399, 400, 5)).toBe(4);
    expect(tabIndexAt(-30, 400, 5)).toBe(0);
    expect(tabIndexAt(900, 400, 5)).toBe(4);
  });
});

describe('tabCenterX', () => {
  it('returns the middle of each tab', () => {
    expect(tabCenterX(0, 400, 5)).toBe(40);
    expect(tabCenterX(4, 400, 5)).toBe(360);
  });
});
