import {
  INITIAL_STOPWATCH,
  start,
  stop,
  lap,
  elapsedMs,
  isRunning,
  lapDurations,
  currentLapMs,
  bestWorstLaps,
  formatStopwatch,
} from '../stopwatch';

describe('stopwatch run/stop', () => {
  it('accumulates time across start/stop cycles', () => {
    let s = start(INITIAL_STOPWATCH, 1000);
    expect(isRunning(s)).toBe(true);
    expect(elapsedMs(s, 3500)).toBe(2500);
    s = stop(s, 3500);
    expect(isRunning(s)).toBe(false);
    expect(elapsedMs(s, 99_999)).toBe(2500); // frozen while stopped
    s = start(s, 10_000);
    expect(elapsedMs(s, 11_000)).toBe(3500);
  });

  it('ignores start when running and stop/lap when stopped', () => {
    const running = start(INITIAL_STOPWATCH, 0);
    expect(start(running, 500)).toBe(running);
    expect(stop(INITIAL_STOPWATCH, 500)).toBe(INITIAL_STOPWATCH);
    expect(lap(INITIAL_STOPWATCH, 500)).toBe(INITIAL_STOPWATCH);
  });
});

describe('laps', () => {
  it('computes completed and current lap durations', () => {
    let s = start(INITIAL_STOPWATCH, 0);
    s = lap(s, 1000);
    s = lap(s, 3000);
    s = lap(s, 3500);
    expect(lapDurations(s)).toEqual([1000, 2000, 500]);
    expect(currentLapMs(s, 4200)).toBe(700);
  });

  it('flags best/worst only with 2+ distinct laps', () => {
    expect(bestWorstLaps([1000])).toBeNull();
    expect(bestWorstLaps([1000, 1000])).toBeNull();
    expect(bestWorstLaps([1000, 2000, 500])).toEqual({ best: 2, worst: 1 });
  });
});

describe('formatStopwatch', () => {
  it('formats mm:ss,cc and adds hours past 60 minutes', () => {
    expect(formatStopwatch(0)).toBe('00:00,00');
    expect(formatStopwatch(65_430)).toBe('01:05,43');
    expect(formatStopwatch(3_723_456)).toBe('1:02:03,45');
  });
});
