import { getDb } from '../db/database';
import type { BatteryReading, BatteryId } from '../../types/battery';

// Row shape of battery_readings. The three nullable columns are only used by
// the energy battery (S-M activity bonus, S-Q satiety reserve) — NULL for the
// nutrient batteries and for rows written before those features existed.
interface BatteryReadingRow {
  date: string;
  battery_type_id: string;
  level: number;
  capacity: number;
  activity_bonus_kcal: number | null;
  satiety_reserve_kcal: number | null;
  last_satiety_sync_at: number | null;
}

function rowToReading(r: BatteryReadingRow): BatteryReading {
  return {
    date: r.date,
    batteryTypeId: r.battery_type_id as BatteryId,
    level: r.level,
    capacity: r.capacity,
    activityBonusKcal: r.activity_bonus_kcal ?? undefined,
    satietyReserveKcal: r.satiety_reserve_kcal ?? undefined,
    lastSatietySyncAt: r.last_satiety_sync_at ?? undefined,
  };
}

const UPSERT_SQL = `INSERT INTO battery_readings
   (date, battery_type_id, level, capacity,
    activity_bonus_kcal, satiety_reserve_kcal, last_satiety_sync_at)
 VALUES (?, ?, ?, ?, ?, ?, ?)
 ON CONFLICT(date, battery_type_id) DO UPDATE SET
   level = excluded.level,
   capacity = excluded.capacity,
   activity_bonus_kcal = excluded.activity_bonus_kcal,
   satiety_reserve_kcal = excluded.satiety_reserve_kcal,
   last_satiety_sync_at = excluded.last_satiety_sync_at`;

function upsertParams(r: BatteryReading) {
  return [
    r.date,
    r.batteryTypeId,
    r.level,
    r.capacity,
    r.activityBonusKcal ?? null,
    r.satietyReserveKcal ?? null,
    r.lastSatietySyncAt ?? null,
  ];
}

export async function getReadingsForDate(date: string): Promise<BatteryReading[]> {
  const db = getDb();
  const rows = await db.getAllAsync<BatteryReadingRow>(
    'SELECT * FROM battery_readings WHERE date = ?',
    date
  );
  return rows.map(rowToReading);
}

export async function upsertReading(reading: BatteryReading): Promise<void> {
  const db = getDb();
  await db.runAsync(UPSERT_SQL, ...upsertParams(reading));
}

export async function upsertReadings(readings: BatteryReading[]): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const r of readings) {
      await db.runAsync(UPSERT_SQL, ...upsertParams(r));
    }
  });
}

export async function getReadingsInRange(
  fromDate: string,
  toDate: string
): Promise<BatteryReading[]> {
  const db = getDb();
  const rows = await db.getAllAsync<BatteryReadingRow>(
    'SELECT * FROM battery_readings WHERE date >= ? AND date <= ? ORDER BY date ASC',
    fromDate,
    toDate
  );
  return rows.map(rowToReading);
}

// Most recent energy-battery reading strictly before `date` (if any) — used to
// carry the satiety reserve across the 6am energy-day rollover.
export async function getLatestEnergyReadingBefore(
  date: string
): Promise<BatteryReading | null> {
  const db = getDb();
  const row = await db.getFirstAsync<BatteryReadingRow>(
    `SELECT * FROM battery_readings
     WHERE battery_type_id = 'energy' AND date < ?
     ORDER BY date DESC LIMIT 1`,
    date
  );
  return row ? rowToReading(row) : null;
}

export async function deleteReadingsBefore(date: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM battery_readings WHERE date < ?', date);
}
