import { isValidBodyWeight, weighInTimestamp } from '../weighIn';

describe('weighInTimestamp — when a weigh-in typed for a day is stored', () => {
  const now = new Date('2026-09-25T20:15:00').getTime();

  it('today: right now, as before', () => {
    expect(weighInTimestamp('2026-09-25', now)).toBe(now);
  });

  it('an earlier day: 07:00 that morning, inside that calendar day', () => {
    expect(weighInTimestamp('2026-09-14', now)).toBe(new Date('2026-09-14T07:00:00').getTime());
  });
});

describe('isValidBodyWeight', () => {
  it('the profile’s range, 20–300 kg', () => {
    expect([79.5, 20, 300].every(isValidBodyWeight)).toBe(true);
    expect([7, 301, NaN].some(isValidBodyWeight)).toBe(false);
  });
});
