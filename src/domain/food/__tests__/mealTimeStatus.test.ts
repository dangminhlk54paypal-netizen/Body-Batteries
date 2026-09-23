import { mealTimeStatus, LATE_LOG_HINT_MINUTES } from '../mealTimeStatus';

const now = new Date(2026, 8, 23, 22, 30, 0, 0).getTime();
const minutesAgo = (m: number) => now - m * 60_000;

describe('mealTimeStatus', () => {
  it('a time after now is "future"', () => {
    expect(mealTimeStatus(now + 60_000, now)).toBe('future');
    expect(mealTimeStatus(now + 3 * 3_600_000, now)).toBe('future');
  });

  it('the current moment and the same minute (seconds zeroed) are "ontime"', () => {
    expect(mealTimeStatus(now, now)).toBe('ontime');
    expect(mealTimeStatus(now - 45_000, now)).toBe('ontime'); // picked hh:mm, now is hh:mm:45
  });

  it('just under the threshold is "ontime", at the threshold it becomes "late"', () => {
    expect(mealTimeStatus(minutesAgo(LATE_LOG_HINT_MINUTES - 1), now)).toBe('ontime');
    expect(mealTimeStatus(minutesAgo(LATE_LOG_HINT_MINUTES), now)).toBe('late');
  });

  it('the user scenario (lunch at 12:00, logging at 22:30) is "late"', () => {
    expect(mealTimeStatus(new Date(2026, 8, 23, 12, 0).getTime(), now)).toBe('late');
  });
});
