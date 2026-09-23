import { firstWeightInRange, weightRecordedOn } from '../trainingLogWeights';

const at = (m: number, d: number, h: number) => new Date(2026, m - 1, d, h).getTime();
const weights = [
  { timestamp: at(8, 26, 20), value: 78.1 }, // evening
  { timestamp: at(8, 26, 7), value: 77.7 }, // morning (out of order on purpose)
  { timestamp: at(8, 28, 8), value: 77.5 },
];

describe('weightRecordedOn', () => {
  it("returns the day's first reading, whatever the input order", () => {
    expect(weightRecordedOn('2026-08-26', weights)).toBe(77.7);
  });

  it('is null on a day without a reading — never carries a weight forward', () => {
    expect(weightRecordedOn('2026-08-27', weights)).toBeNull();
    expect(weightRecordedOn('2026-08-26', [])).toBeNull();
  });
});

describe('firstWeightInRange', () => {
  it('returns the earliest reading inside the inclusive range', () => {
    expect(firstWeightInRange('2026-08-24', '2026-08-30', weights)).toBe(77.7);
    expect(firstWeightInRange('2026-08-27', '2026-08-30', weights)).toBe(77.5);
  });

  it('is null when nothing falls in the range', () => {
    expect(firstWeightInRange('2026-09-01', '2026-09-07', weights)).toBeNull();
  });
});
