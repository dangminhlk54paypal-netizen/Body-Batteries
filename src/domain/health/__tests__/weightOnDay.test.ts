import { weightOnOrBefore } from '../weightOnDay';

describe('weightOnOrBefore', () => {
  it('carries forward the most recent weight logged on or before the day', () => {
    const weights = [
      { timestamp: new Date('2026-07-01T09:00:00').getTime(), value: 70 },
      { timestamp: new Date('2026-06-25T09:00:00').getTime(), value: 68 },
    ];
    expect(weightOnOrBefore('2026-07-03', weights)).toBe(70);
  });

  it('picks the latest same-day weight when multiple are logged that day', () => {
    const weights = [
      { timestamp: new Date('2026-07-03T07:00:00').getTime(), value: 70 },
      { timestamp: new Date('2026-07-03T20:00:00').getTime(), value: 71 },
    ];
    expect(weightOnOrBefore('2026-07-03', weights)).toBe(71);
  });

  it('ignores weights logged after the day', () => {
    const weights = [{ timestamp: new Date('2026-07-05T09:00:00').getTime(), value: 70 }];
    expect(weightOnOrBefore('2026-07-01', weights)).toBe('');
  });

  it('returns blank when there is no weight history at all', () => {
    expect(weightOnOrBefore('2026-07-01', [])).toBe('');
  });
});
