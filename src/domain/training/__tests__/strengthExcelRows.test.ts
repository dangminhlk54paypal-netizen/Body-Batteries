import { buildLiftMaxSheet, buildStrengthProgressSheet } from '../strengthExcelRows';
import { bodyWeightOn } from '../trainingLogProgress';
import { dateCell, tableAsObjects } from '../../export/sheetTable';

describe('Excel training sheets', () => {
  it('one row per week: real dates, top kg and e1RM per lift, body weight, ratio e1RM ÷ body weight', () => {
    const table = buildStrengthProgressSheet(
      [
        {
          weekStart: '2026-08-03',
          weekEnd: '2026-08-09',
          bodyWeightKg: 80,
          bodyWeightSource: 'measured',
          top: { squat: 160, deadlift: 200 },
          e1rm: { squat: 176, deadlift: 200 },
        },
      ],
      'vi'
    );
    const [row] = tableAsObjects(table);
    expect(row['Tuần từ']).toEqual(dateCell('2026-08-03'));
    expect(row['Đến']).toEqual(dateCell('2026-08-09'));
    expect(row['Cân nặng (kg)']).toBe(80);
    expect(row['Squat nặng nhất (kg)']).toBe(160);
    expect(row['Squat e1RM (kg)']).toBe(176);
    expect(row['Squat ratio (e1RM ÷ cân nặng)']).toBe(2.2);
    // A lift not trained that week is an empty cell, not 0.
    expect(row['Bench press nặng nhất (kg)']).toBeNull();
  });

  it('1RM rows are oldest first, real dates, with that week’s body weight and the ratio', () => {
    const table = buildLiftMaxSheet(
      [
        { id: 'b', lift: 'deadlift', weightKg: 220, date: '2026-09-01', note: 'thi đấu', createdAt: 2 },
        { id: 'a', lift: 'squat', weightKg: 180, date: '2026-08-12', note: null, createdAt: 1 },
      ],
      () => 80,
      'en'
    );
    const rows = tableAsObjects(table);
    expect(rows.map((r) => r['Weight (kg)'])).toEqual([180, 220]);
    expect(rows[0]['Date']).toEqual(dateCell('2026-08-12'));
    expect(rows[0]['Ratio (÷ body weight)']).toBe(2.25);
    expect(rows[0]['Note']).toBeNull();
    expect(rows[1]['Note']).toBe('thi đấu');
  });
});

describe('bodyWeightOn', () => {
  const at = (d: string) => new Date(`${d}T07:00:00`).getTime();
  it('the week’s average, else the latest before, else the first reading, else the fallback', () => {
    const weights = [
      { timestamp: at('2026-08-04'), value: 79 },
      { timestamp: at('2026-08-06'), value: 78 },
    ];
    expect(bodyWeightOn('2026-08-07', weights)).toBe(78.5);
    expect(bodyWeightOn('2026-08-20', weights)).toBe(78);
    expect(bodyWeightOn('2026-07-01', weights, 82)).toBe(79); // a real reading beats the profile
    expect(bodyWeightOn('2026-07-01', [], 82)).toBe(82);
    expect(bodyWeightOn('2026-07-01', [])).toBeNull();
  });
});
