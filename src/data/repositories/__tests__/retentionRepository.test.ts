import { deleteTrimmableRows, getOldestTrimmableDate, getTrimmableRows, restoreRows } from '../retentionRepository';

// A fake DB that records every statement, so the test can check which
// tables/rows each Kho choice leaves alone.
const mockCalls: { sql: string; params: unknown[] }[] = [];
const mockFirstResults: Record<string, unknown> = {};
const mockDb = {
  getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
    mockCalls.push({ sql, params });
    const table = /FROM (\w+)/.exec(sql)?.[1] ?? '';
    return { v: mockFirstResults[table] ?? null };
  }),
  getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
    mockCalls.push({ sql, params });
    if (sql.startsWith('PRAGMA table_info')) return [{ name: 'id' }, { name: 'timestamp' }];
    return [];
  }),
  runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
    mockCalls.push({ sql, params });
    return { changes: 1 };
  }),
  withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => fn()),
};
jest.mock('../../db/database', () => ({ getDb: () => mockDb }));

const allOn = { weight: true, gym: true, eatingHabits: true };
const allOff = { weight: false, gym: false, eatingHabits: false };

beforeEach(() => {
  mockCalls.length = 0;
  for (const k of Object.keys(mockFirstResults)) delete mockFirstResults[k];
});

const sqlFor = (table: string) => mockCalls.filter((c) => new RegExp(`(FROM|INTO) ${table}\\b`).test(c.sql)).map((c) => c.sql);

describe('deleteTrimmableRows', () => {
  it('with every Kho on: training tables untouched, workouts and weigh-ins kept', async () => {
    await deleteTrimmableRows('2026-07-01', allOn);
    expect(sqlFor('training_log_days')).toEqual([]);
    expect(sqlFor('lift_maxes')).toEqual([]);
    expect(sqlFor('eating_daily_summary')).toEqual([]);
    expect(sqlFor('activity_log')).toEqual([
      "DELETE FROM activity_log WHERE timestamp < ? AND NOT (workouts != '[]')",
    ]);
    expect(sqlFor('health_signals')[0]).toContain("NOT (source = 'manual' AND type = 'weight_kg')");
    const food = mockCalls.find((c) => c.sql.startsWith('DELETE FROM food_log'))!;
    expect(food.params).toEqual([new Date('2026-07-01T00:00:00').getTime()]);
  });

  it('with every Kho off: everything dated before the cutoff goes, except the active block', async () => {
    await deleteTrimmableRows('2026-07-01', allOff);
    expect(sqlFor('activity_log')).toEqual(['DELETE FROM activity_log WHERE timestamp < ?']);
    expect(sqlFor('training_blocks')).toEqual(['DELETE FROM training_blocks WHERE created_at < ? AND is_active = 0']);
    const months = mockCalls.find((c) => c.sql.startsWith('DELETE FROM training_log_months'))!;
    expect(months.params).toEqual(['2026-07']);
  });
});

it('getOldestTrimmableDate converts each date style and takes the earliest', async () => {
  mockFirstResults.food_log = new Date('2026-02-10T12:00:00').getTime();
  mockFirstResults.battery_readings = '2026-03-01';
  mockFirstResults.training_log_months = '2026-01';
  expect(await getOldestTrimmableDate(allOn)).toBe('2026-02-10');
  expect(await getOldestTrimmableDate(allOff)).toBe('2026-01-01');
});

it('getTrimmableRows reads the same rows the delete removes', async () => {
  await getTrimmableRows('2026-07-01', allOn);
  expect(sqlFor('activity_log')).toEqual(["SELECT * FROM activity_log WHERE timestamp < ? AND NOT (workouts != '[]')"]);
});

it('restoreRows skips unknown tables and columns, never overwrites', async () => {
  const added = await restoreRows({
    food_log: [{ id: 'a', timestamp: 1, dropped_column: 'x' }],
    sqlite_master: [{ name: 'evil' }],
  });
  expect(added).toBe(1);
  const insert = mockCalls.find((c) => c.sql.startsWith('INSERT'))!;
  expect(insert.sql).toBe('INSERT OR IGNORE INTO food_log (id, timestamp) VALUES (?, ?)');
  expect(mockCalls.some((c) => c.sql.includes('sqlite_master'))).toBe(false);
});

// RETENTION_SQL_DUMP=<file> npx jest … writes every statement the two Kho
// extremes produce, to run against a real SQLite file outside Jest (Jest has
// no SQLite). Skipped otherwise.
it('statement dump', async () => {
  if (!process.env.RETENTION_SQL_DUMP) return;
  await getOldestTrimmableDate(allOn);
  await getOldestTrimmableDate(allOff);
  for (const archive of [allOn, allOff]) {
    await getTrimmableRows('2026-07-01', archive);
    await deleteTrimmableRows('2026-07-01', archive);
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('fs').writeFileSync(process.env.RETENTION_SQL_DUMP, JSON.stringify(mockCalls));
});
