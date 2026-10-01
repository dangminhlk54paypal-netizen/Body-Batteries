import {
  EXPORT_MICRO_IDS,
  buildActivitySheet,
  buildBatterySheet,
  buildDailyNotesSheet,
  buildDailySheet,
  buildFoodSheet,
  buildPeriodAveragesSheet,
  buildQuickLogSheet,
  buildReadMeSheet,
  buildReferenceSheet,
  type DataWorkbookInput,
  type SheetGuideKey,
} from '../dataWorkbook';
import { dateCell, tableAsObjects, timeCell, type SheetTable } from '../sheetTable';
import { nutrientTargetsForProfile } from '../../../lib/nutrientTargets';
import { translate } from '../../../i18n/translate';
import type { FoodItem, FoodLogEntry } from '../../../types/food';
import type { ActivityLogEntry } from '../../../types/energy';
import type { Language } from '../../../i18n/types';

const at = (date: string, h: number, m = 0) =>
  new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime();

const per100g = {
  energyKcal: 130,
  waterG: 68,
  proteinG: 2.7,
  fatG: 0.3,
  carbG: 28,
  fiberG: 0.4,
  sugarG: 0.1,
  calciumMg: 10,
  ironMg: 0.2,
  sodiumMg: 1,
  potassiumMg: 35,
  magnesiumMg: 12,
  zincMg: 0.5,
};
const RICE: FoodItem = {
  id: 'rice',
  nameVi: 'Cơm trắng',
  nameEn: 'White rice',
  nameDe: 'Reis',
  category: 'grain',
  defaultServingG: 150,
  servingPresets: [],
  per100g,
  source: 'test',
  note: '',
};
const lookup = (id: string) => (id === 'rice' ? RICE : undefined);

const food = (id: string, ts: number, over: Partial<FoodLogEntry> = {}): FoodLogEntry => ({
  id,
  timestamp: ts,
  mealType: 'lunch',
  foodId: 'rice',
  foodNameVi: 'Cơm trắng',
  grams: 200,
  energyKcal: 260,
  proteinG: 5.4,
  fatG: 0.6,
  carbG: 56,
  waterG: 136,
  mineralsMg: 50,
  ...over,
});

const activity = (id: string, startAt: number, over: Partial<ActivityLogEntry> = {}): ActivityLogEntry => ({
  id,
  timestamp: startAt,
  startAt,
  endAt: startAt + 45 * 60_000,
  steps: 0,
  workouts: [{ type: 'running', minutes: 45 }],
  energyKcal: 400,
  satietyDrainKcal: 0,
  energyDayApplied: '',
  ...over,
});

const profile = { weightKg: 78, heightCm: 168, age: 30, sex: 'male' as const, occupation: 'sedentary' as const };

function input(over: Partial<DataWorkbookInput> = {}): DataWorkbookInput {
  return {
    fromDate: '2026-09-01',
    toDate: '2026-09-30',
    exportedOn: '2026-10-01',
    language: 'vi',
    profile,
    targets: nutrientTargetsForProfile(profile),
    foodLog: [],
    activityLog: [],
    intakeLog: [],
    readings: [],
    weights: [],
    appleHealthBurned: new Map(),
    lookup,
    ...over,
  };
}

// The rule every data sheet follows: each row is one record, as wide as the header.
function expectCleanTable(table: SheetTable) {
  for (const row of table.rows) {
    expect(row).toHaveLength(table.columns.length);
    expect(row.every((v) => v == null)).toBe(false); // no blank separator rows
  }
}

describe('Theo ngày (daily)', () => {
  const data = input({
    foodLog: [food('a', at('2026-09-10', 12)), food('b', at('2026-09-10', 19), { energyKcal: 500 })],
    activityLog: [activity('r', at('2026-09-11', 7))],
    weights: [
      { timestamp: at('2026-09-10', 6), value: 79 },
      { timestamp: at('2026-09-10', 21), value: 79.6 },
    ],
    readings: [{ date: '2026-09-10', batteryTypeId: 'energy', level: 0, capacity: 2500 }],
    appleHealthBurned: new Map([['2026-09-11', 2800]]),
  });

  it('one row per day with anything logged, oldest first, the date a real date', () => {
    const table = buildDailySheet(data);
    expectCleanTable(table);
    expect(table.rows.map((r) => r[0])).toEqual([dateCell('2026-09-10'), dateCell('2026-09-11')]);
  });

  it('weight measured that day (averaged), never carried to the next day', () => {
    const [d10, d11] = tableAsObjects(buildDailySheet(data));
    expect(d10['Cân nặng (kg)']).toBe(79.3);
    expect(d11['Cân nặng (kg)']).toBeNull();
  });

  it('total burn: Apple Health when synced, else the app estimate — and says which', () => {
    const [d10, d11] = tableAsObjects(buildDailySheet(data));
    expect(d10['Tổng tiêu hao (kcal)']).toBe(2500);
    expect(d10['Nguồn tiêu hao']).toBe('Ước tính của app');
    expect(d10['Cân bằng (kcal)']).toBe(760 - 2500);
    expect(d11['Tổng tiêu hao (kcal)']).toBe(2800);
    expect(d11['Nguồn tiêu hao']).toBe('Apple Health');
    // No food logged that day → no eaten / balance numbers (unknown, not 0).
    expect(d11['Kcal ăn']).toBeNull();
    expect(d11['Cân bằng (kcal)']).toBeNull();
    expect(d11['Kcal vận động']).toBe(400);
  });

  it('micronutrient columns carry the unit in the header and bare numbers below', () => {
    const table = buildDailySheet(data);
    expect(table.columns).toContain('Đường (g)');
    expect(table.columns).toContain('Natri (mg)');
    expect(table.columns).not.toContain('Natri (muối) (mg)');
    const sugar = tableAsObjects(table)[0]['Đường (g)'];
    expect(sugar).toBe(0.4); // 400 g rice × 0.1 g/100 g
  });
});

describe('Món ăn (foods)', () => {
  it('one row per food, real date + time, portion only when counted, names in the export language', () => {
    const table = buildFoodSheet(
      input({
        language: 'en',
        foodLog: [
          food('late', at('2026-09-10', 19, 30)),
          food('early', at('2026-09-10', 7, 5)),
          food('pill', at('2026-09-10', 8), { foodId: 'gone', foodNameVi: 'Viên cá', portionUnit: 'capsule', count: 2, grams: 2 }),
        ],
      })
    );
    expectCleanTable(table);
    const rows = tableAsObjects(table);
    expect(rows.map((r) => r['Time'])).toEqual([
      timeCell(at('2026-09-10', 7, 5)),
      timeCell(at('2026-09-10', 8)),
      timeCell(at('2026-09-10', 19, 30)),
    ]);
    expect(rows[0]['Food']).toBe('White rice');
    expect(rows[0]['Portion']).toBeNull(); // a gram entry: the Grams column says it all
    expect(rows[1]['Portion']).not.toBeNull();
    // A food no longer in the catalog: the logged name, micronutrients unknown (empty, not 0).
    expect(rows[1]['Food']).toBe('Viên cá');
    expect(rows[1]['Sugar (g)']).toBeNull();
  });
});

describe('Vận động (activity) and Nước & ngủ (quick logs)', () => {
  it('activity: one row per entry, workouts named, steps-only entries labelled', () => {
    const table = buildActivitySheet(
      input({
        activityLog: [
          activity('steps', at('2026-09-12', 18), { workouts: [], steps: 8000, energyKcal: 300, endAt: undefined }),
          activity('run', at('2026-09-12', 7)),
        ],
      })
    );
    expectCleanTable(table);
    const [run, steps] = tableAsObjects(table);
    expect(run['Hoạt động']).toBe('Chạy bộ');
    expect(run['Phút']).toBe(45);
    expect(run['Kết thúc']).toEqual(timeCell(at('2026-09-12', 7, 45)));
    expect(steps['Hoạt động']).toBe('Bước chân');
    expect(steps['Bước']).toBe(8000);
    expect(steps['Kết thúc']).toBeNull();
  });

  it('quick logs: amount and unit in separate columns', () => {
    const [row] = tableAsObjects(
      buildQuickLogSheet(
        input({ intakeLog: [{ id: 'w', timestamp: at('2026-09-12', 9), batteryTypeId: 'water', amount: 500, note: '' }] })
      )
    );
    expect(row['Lượng']).toBe(500);
    expect(row['Đơn vị']).toBe('ml');
    expect(row['Ghi chú']).toBeNull();
  });
});

describe('Trung bình kỳ (period averages)', () => {
  it('divides by the days with food logged — a 30-day export no longer divides by 7', () => {
    // 3 logged days of 200 g rice → fiber 0.8 g a day, whatever the period length.
    const foodLog = ['2026-09-02', '2026-09-15', '2026-09-28'].map((d) => food(d, at(d, 12)));
    const rows = tableAsObjects(buildPeriodAveragesSheet(input({ foodLog })));
    const fiber = rows.find((r) => r['Chất'] === 'Chất xơ')!;
    expect(fiber['TB/ngày']).toBe(0.8);
    expect(fiber['Số ngày tính']).toBe(3);
    expect(fiber['Kiểu']).toBe('Cần đủ');
    expect(rows.find((r) => r['Chất'] === 'Đường')!['Kiểu']).toBe('Mức trần');
  });

  it('no food logged → no average rows', () => {
    expect(buildPeriodAveragesSheet(input()).rows).toEqual([]);
  });
});

describe('Góp ý theo ngày, Ngưỡng, Pin', () => {
  it('daily notes: only the (day, nutrient) pairs worth a note, one per row', () => {
    const table = buildDailyNotesSheet(input({ foodLog: [food('a', at('2026-09-10', 12))] }));
    expectCleanTable(table);
    expect(table.rows.length).toBeGreaterThan(0);
    expect(tableAsObjects(table).every((r) => typeof r['Góp ý'] === 'string')).toBe(true);
  });

  it('reference table carries no disclaimer row (it lives in Read me)', () => {
    const table = buildReferenceSheet(input());
    expectCleanTable(table);
    expect(table.rows.every((r) => r[0] !== '')).toBe(true);
  });

  it('battery readings: energy first, then the sub-batteries, with units', () => {
    const rows = tableAsObjects(
      buildBatterySheet(
        input({
          readings: [
            { date: '2026-09-10', batteryTypeId: 'water', level: 1000, capacity: 3000 },
            { date: '2026-09-10', batteryTypeId: 'energy', level: 1200, capacity: 2400 },
          ],
        })
      )
    );
    expect(rows.map((r) => [r['Pin'], r['Đơn vị'], r['%']])).toEqual([
      ['Năng lượng', 'kcal', 50],
      ['Nước', 'ml', 33],
    ]);
  });
});

describe('Đọc trước (read me)', () => {
  const KEYS: SheetGuideKey[] = [
    'daily',
    'foods',
    'activity',
    'quickLogs',
    'periodAverages',
    'dailyNotes',
    'referenceThresholds',
    'batteryReadings',
    'strengthProgress',
    'liftMaxes',
  ];

  it.each(['vi', 'en', 'de'] as Language[])('every sheet has a guide line in %s (dynamic keys)', (language) => {
    for (const key of KEYS) {
      const text = translate(language, `export.readMe.guide.${key}`);
      expect(text).not.toBe(`export.readMe.guide.${key}`);
      expect(translate(language, `export.sheets.${key}`)).not.toBe(`export.sheets.${key}`);
    }
  });

  it('lists each sheet with its row count, and ends with the disclaimer', () => {
    const data = input({ foodLog: [food('a', at('2026-09-10', 12))] });
    const daily = buildDailySheet(data);
    const table = buildReadMeSheet(data, [{ key: 'daily', table: daily }]);
    const labels = table.rows.map((r) => r[0]);
    expect(labels).toContain('📄 Theo ngày (1 dòng)');
    expect(table.rows[table.rows.length - 1][1]).toBe(translate('vi', 'assessment.disclaimer'));
  });

  it('sheet names fit Excel’s 31-character limit in every language', () => {
    for (const language of ['vi', 'en', 'de'] as Language[]) {
      for (const key of [...KEYS, 'readMe']) {
        expect(translate(language, `export.sheets.${key}`).length).toBeLessThanOrEqual(31);
      }
    }
  });
});

it('EXPORT_MICRO_IDS leaves fat out (it is already the macro column)', () => {
  expect(EXPORT_MICRO_IDS).not.toContain('fat');
});
