import { suspiciousWeightIds } from '../weightOutliers';

const at = (date: string) => new Date(`${date}T07:00:00`).getTime();
const w = (id: number, date: string, value: number) => ({ id, timestamp: at(date), value });

describe('suspiciousWeightIds — a reading that jumps away and comes back', () => {
  it('flags 79.5 between 76.0 and 75.8 (the user’s case)', () => {
    const ids = suspiciousWeightIds([w(1, '2026-09-11', 76), w(2, '2026-09-14', 79.5), w(3, '2026-09-15', 75.8)]);
    expect([...ids]).toEqual([2]);
  });

  it('flags a dip too, but not a real trend or a normal swing', () => {
    expect([...suspiciousWeightIds([w(1, '2026-09-01', 80), w(2, '2026-09-02', 70.5), w(3, '2026-09-03', 79.8)])]).toEqual([2]);
    // Steady loss: each step is small and goes one way.
    expect(suspiciousWeightIds([w(1, '2026-09-01', 80), w(2, '2026-09-08', 78), w(3, '2026-09-15', 76)]).size).toBe(0);
    // Everyday water swing under 2 kg.
    expect(suspiciousWeightIds([w(1, '2026-09-01', 76), w(2, '2026-09-02', 77.5), w(3, '2026-09-03', 76.2)]).size).toBe(0);
  });

  it('no flag across a long gap, or for the first/last reading', () => {
    expect(suspiciousWeightIds([w(1, '2026-06-01', 76), w(2, '2026-09-14', 79.5), w(3, '2026-09-15', 75.8)]).size).toBe(0);
    expect(suspiciousWeightIds([w(1, '2026-09-14', 79.5), w(2, '2026-09-15', 75.8)]).size).toBe(0);
  });
});
