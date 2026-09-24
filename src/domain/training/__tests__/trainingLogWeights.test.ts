import { firstWeightInRange, weekHeadingWeight, weightRecordedOn } from '../trainingLogWeights';

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

describe('weekHeadingWeight', () => {
  it("uses the week's own first weigh-in when there is one", () => {
    expect(weekHeadingWeight('2026-08-24', '2026-08-30', weights)).toBe(77.7);
  });

  it('carries the latest earlier reading forward into a week without one', () => {
    expect(weekHeadingWeight('2026-08-31', '2026-09-06', weights)).toBe(77.5);
    expect(weekHeadingWeight('2026-09-14', '2026-09-20', weights)).toBe(77.5);
  });

  it('is null when nothing was ever logged before or during the week', () => {
    expect(weekHeadingWeight('2026-08-17', '2026-08-23', weights)).toBeNull();
    expect(weekHeadingWeight('2026-08-24', '2026-08-30', [])).toBeNull();
  });
});
