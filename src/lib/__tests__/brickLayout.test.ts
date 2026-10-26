import { brickCapacity, brickCost, packBrickRows } from '../brickLayout';

const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

describe('packBrickRows', () => {
  it('lays the 7 Home detail tiles out as a 2 · 3 · 2 brick wall', () => {
    const titles = ['Đã ăn', 'Vận động', 'Cân bằng', 'Vi chất', 'TPCN', 'Caffeine', 'Nạp nhanh'];
    expect(packBrickRows(titles.map(brickCost), brickCapacity(390))).toEqual([2, 3, 2]);
  });

  it('never puts the same count in two neighbour rows when avoidable', () => {
    const rows = packBrickRows([10, 10, 10, 10, 10], 40);
    expect(sum(rows)).toBe(5);
    for (let i = 1; i < rows.length; i++) expect(rows[i]).not.toBe(rows[i - 1]);
  });

  it('keeps every row between 1 and 3 tiles and within the width', () => {
    const costs = [14, 30, 9, 9, 9, 25, 12, 12];
    const rows = packBrickRows(costs, 40);
    expect(sum(rows)).toBe(costs.length);
    let i = 0;
    for (const k of rows) {
      expect(k).toBeGreaterThanOrEqual(1);
      expect(k).toBeLessThanOrEqual(3);
      if (k > 1) expect(sum(costs.slice(i, i + k))).toBeLessThanOrEqual(40);
      i += k;
    }
  });

  it('gives a too-long title a row of its own', () => {
    expect(packBrickRows([50, 10, 10], 40)).toEqual([1, 2]);
  });

  it('handles empty and single input', () => {
    expect(packBrickRows([], 40)).toEqual([]);
    expect(packBrickRows([10], 40)).toEqual([1]);
  });
});
