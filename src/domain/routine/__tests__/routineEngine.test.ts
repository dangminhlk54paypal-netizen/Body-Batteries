import {
  analyzeMetric,
  analyzeRoutines,
  dailyTotals,
  defaultSleepTimes,
  metricsToAutoFill,
  parseClockTime,
  sleepHoursBetween,
  slotForHour,
  roundForMetric,
} from '../routineEngine';
import type { IntakeEvent, BatteryId } from '../../../types/battery';

const TODAY = '2026-11-10';

function ev(date: string, battery: BatteryId, amount: number, note = '', hour = 12): IntakeEvent {
  const ts = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime();
  return { id: `${battery}_${ts}_${amount}`, timestamp: ts, batteryTypeId: battery, amount, note };
}

describe('dailyTotals', () => {
  it('sums per local day and nets out undo (negative) events', () => {
    const events = [
      ev('2026-11-09', 'water', 500, '', 8),
      ev('2026-11-09', 'water', 1500, '', 20),
      ev('2026-11-09', 'water', -500, 'routine:undo', 21),
      ev('2026-11-09', 'protein', 30),
    ];
    expect(dailyTotals(events, 'water')).toEqual({ '2026-11-09': 1500 });
  });

  it('reads walking minutes from workout notes', () => {
    const events = [
      ev('2026-11-09', 'energy', 120, 'workout: walking 30m'),
      ev('2026-11-09', 'energy', 80, 'workout: brisk_walking 15m'),
      ev('2026-11-09', 'energy', 300, 'workout: running 30m'),
      ev('2026-11-09', 'energy', 500, 'calories'),
    ];
    expect(dailyTotals(events, 'walkMinutes')).toEqual({ '2026-11-09': 45 });
  });

  it('maps steps to the movement battery', () => {
    expect(dailyTotals([ev('2026-11-09', 'movement', 5000)], 'steps')).toEqual({
      '2026-11-09': 5000,
    });
  });
});

describe('analyzeMetric', () => {
  it('detects a 3-day stable streak as a routine', () => {
    const r = analyzeMetric(
      'steps',
      { '2026-11-09': 5000, '2026-11-08': 5200, '2026-11-07': 4800 },
      TODAY
    );
    expect(r.streakDays).toBe(3);
    expect(r.isRoutine).toBe(true);
    expect(r.suggested).toBe(5000);
  });

  it('is not a routine with only 2 days', () => {
    const r = analyzeMetric('steps', { '2026-11-09': 5000, '2026-11-08': 5000 }, TODAY);
    expect(r.isRoutine).toBe(false);
    expect(r.suggested).toBe(5000); // the suggest button still works
  });

  it('breaks the streak on a missing day', () => {
    const r = analyzeMetric(
      'water',
      { '2026-11-09': 2000, '2026-11-07': 2000, '2026-11-06': 2000 },
      TODAY
    );
    expect(r.streakDays).toBe(1);
    expect(r.isRoutine).toBe(false);
  });

  it('is not a routine when values vary too much', () => {
    const r = analyzeMetric(
      'water',
      { '2026-11-09': 2000, '2026-11-08': 500, '2026-11-07': 2000 },
      TODAY
    );
    expect(r.streakDays).toBe(3);
    expect(r.isRoutine).toBe(false);
  });

  it('caps the streak at 7 days and ignores older data', () => {
    const totals: Record<string, number> = {};
    for (let d = 1; d <= 9; d++) totals[`2026-11-${String(10 - d).padStart(2, '0')}`] = 7.5;
    totals['2026-10-31'] = 2; // 10 days ago — outside the window
    const r = analyzeMetric('sleep', totals, TODAY);
    expect(r.streakDays).toBe(7);
    expect(r.suggested).toBe(7.5);
  });

  it('reports what was logged today and handles no history', () => {
    const r = analyzeMetric('sleep', { [TODAY]: 6 }, TODAY);
    expect(r.loggedToday).toBe(6);
    expect(r.suggested).toBeNull();
    expect(r.isRoutine).toBe(false);
  });
});

describe('metricsToAutoFill', () => {
  const events = ['2026-11-09', '2026-11-08', '2026-11-07'].flatMap((d) => [
    ev(d, 'sleep', 7.5),
    ev(d, 'water', 2000),
    ev(d, 'movement', 5000),
  ]);
  const insights = analyzeRoutines(events, TODAY);

  it('fills nothing before the morning window', () => {
    expect(metricsToAutoFill(insights, 5, {})).toEqual([]);
  });

  it('fills sleep from the morning, water+steps from the evening', () => {
    expect(metricsToAutoFill(insights, 7, {})).toEqual(['sleep']);
    expect(metricsToAutoFill(insights, 21, {})).toEqual(['sleep', 'water', 'steps']);
  });

  it('skips metrics already auto-filled or logged today', () => {
    const withToday = analyzeRoutines([...events, ev(TODAY, 'water', 300)], TODAY);
    expect(metricsToAutoFill(withToday, 21, { sleep: 7.5 })).toEqual(['steps']);
  });

  it('does not re-fill a metric the user undid today (kept as 0)', () => {
    expect(metricsToAutoFill(insights, 7, { sleep: 0 })).toEqual([]);
  });
});

describe('slotForHour', () => {
  it('maps hours to check-in windows', () => {
    expect(slotForHour(5)).toBeNull();
    expect(slotForHour(6)).toBe('morning');
    expect(slotForHour(7)).toBe('morning');
    expect(slotForHour(8)).toBeNull();
    expect(slotForHour(20)).toBe('evening');
    expect(slotForHour(21)).toBe('evening');
    expect(slotForHour(22)).toBeNull();
  });
});

describe('sleep time helpers', () => {
  it('parses common time formats', () => {
    expect(parseClockTime('23:00')).toBe(1380);
    expect(parseClockTime('6h30')).toBe(390);
    expect(parseClockTime('6')).toBe(360);
    expect(parseClockTime('25:00')).toBeNull();
    expect(parseClockTime('abc')).toBeNull();
  });

  it('computes hours across midnight', () => {
    expect(sleepHoursBetween('23:00', '06:30')).toBe(7.5);
    expect(sleepHoursBetween('01:10', '07:00')).toBe(5.75);
    expect(sleepHoursBetween('07:00', '07:00')).toBeNull();
  });

  it('derives default times', () => {
    expect(defaultSleepTimes({ bedtime: null, wakeTime: null }, 7)).toEqual({
      bedtime: '23:30',
      wakeTime: '06:30',
    });
    expect(defaultSleepTimes({ bedtime: '22:45', wakeTime: '06:00' }, 7)).toEqual({
      bedtime: '22:45',
      wakeTime: '06:00',
    });
  });

  it('rounds per metric', () => {
    expect(roundForMetric('water', 1980)).toBe(2000);
    expect(roundForMetric('steps', 5049)).toBe(5000);
    expect(roundForMetric('sleep', 7.4)).toBe(7.5);
  });
});
