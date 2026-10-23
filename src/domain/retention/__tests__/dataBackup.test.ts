import { countBackupRows, DATA_BACKUP_VERSION, parseDataBackup, serializeDataBackup } from '../dataBackup';

const tables = {
  food_log: [{ id: 'f1', timestamp: 1, food_name_vi: 'Cơm', count: null }],
  battery_readings: [
    { date: '2026-01-01', battery_type_id: 'water', level: 1500 },
    { date: '2026-01-02', battery_type_id: 'water', level: 1700 },
  ],
};

it('round-trips the rows and the covered range', () => {
  const parsed = parseDataBackup(serializeDataBackup(tables, { fromDate: '2026-01-01', toDate: '2026-06-30' }, 42));
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(parsed.backup.tables).toEqual(tables);
  expect(parsed.backup.fromDate).toBe('2026-01-01');
  expect(parsed.backup.toDate).toBe('2026-06-30');
  expect(countBackupRows(parsed.backup)).toBe(3);
});

it('rejects what is not a data backup', () => {
  expect(parseDataBackup('not json')).toEqual({ ok: false, reasonKey: 'unreadable' });
  expect(parseDataBackup('{"version":1,"customFoods":[]}')).toEqual({ ok: false, reasonKey: 'notBackup' });
});

it('rejects a file from a newer app version instead of guessing', () => {
  const newer = JSON.stringify({ format: 'bodybatteries-data-backup', version: DATA_BACKUP_VERSION + 1, tables: {} });
  expect(parseDataBackup(newer)).toEqual({ ok: false, reasonKey: 'newerVersion' });
});

it('drops cell values SQLite could not have written', () => {
  const text = JSON.stringify({
    format: 'bodybatteries-data-backup',
    version: 1,
    tables: { food_log: [{ id: 'x', nested: { a: 1 }, flag: true }], junk: 'nope' },
  });
  const parsed = parseDataBackup(text);
  expect(parsed.ok && parsed.backup.tables).toEqual({ food_log: [{ id: 'x' }] });
});
