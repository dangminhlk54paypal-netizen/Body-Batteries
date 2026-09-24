import { buildLiftMaxRows, buildStrengthProgressRows } from '../strengthExcelRows';
import { bodyWeightOn } from '../trainingLogProgress';

describe('Excel training sheets', () => {
  it('one row per week: top kg per lift, body weight, and × body weight', () => {
    const rows = buildStrengthProgressRows(
      [{ weekStart: '2026-08-03', weekEnd: '2026-08-09', bodyWeightKg: 80, bodyWeightSource: 'measured', top: { squat: 160, deadlift: 200 } }],
      'vi'
    );
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row['Cân nặng (kg)']).toBe(80);
    expect(Object.entries(row).find(([k]) => k.startsWith('Squat') && k.includes('nặng nhất'))?.[1]).toBe(160);
    expect(Object.entries(row).find(([k]) => k.startsWith('Squat') && k.includes('× cân nặng'))?.[1]).toBe(2);
    // A lift not trained that week is an empty cell, not 0.
    expect(Object.entries(row).find(([k]) => k.includes('Bench') && k.includes('nặng nhất'))?.[1]).toBe('');
  });

  it('1RM rows are oldest first with the ratio to that day’s body weight', () => {
    const rows = buildLiftMaxRows(
      [
        { id: 'b', lift: 'deadlift', weightKg: 220, date: '2026-09-01', note: 'thi đấu', createdAt: 2 },
        { id: 'a', lift: 'squat', weightKg: 180, date: '2026-08-12', note: null, createdAt: 1 },
      ],
      () => 80,
      'en'
    );
    expect(rows.map((r) => r['Weight (kg)'])).toEqual([180, 220]);
    expect(rows[0]['× body weight']).toBe(2.25);
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
