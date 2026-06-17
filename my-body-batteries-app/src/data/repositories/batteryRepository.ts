import { getDb } from '../db/database';
import type { BatteryReading, BatteryId } from '../../types/battery';

export async function getReadingsForDate(date: string): Promise<BatteryReading[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    date: string;
    battery_type_id: string;
    level: number;
    capacity: number;
  }>('SELECT * FROM battery_readings WHERE date = ?', date);

  return rows.map((r) => ({
    date: r.date,
    batteryTypeId: r.battery_type_id as BatteryId,
    level: r.level,
    capacity: r.capacity,
  }));
}

export async function upsertReading(reading: BatteryReading): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO battery_readings (date, battery_type_id, level, capacity)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date, battery_type_id) DO UPDATE SET
       level = excluded.level,
       capacity = excluded.capacity`,
    reading.date,
    reading.batteryTypeId,
    reading.level,
    reading.capacity
  );
}

export async function upsertReadings(readings: BatteryReading[]): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const r of readings) {
      await db.runAsync(
        `INSERT INTO battery_readings (date, battery_type_id, level, capacity)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(date, battery_type_id) DO UPDATE SET
           level = excluded.level,
           capacity = excluded.capacity`,
        r.date,
        r.batteryTypeId,
        r.level,
        r.capacity
      );
    }
  });
}

export async function getReadingsInRange(
  fromDate: string,
  toDate: string
): Promise<BatteryReading[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    date: string;
    battery_type_id: string;
    level: number;
    capacity: number;
  }>(
    'SELECT * FROM battery_readings WHERE date >= ? AND date <= ? ORDER BY date ASC',
    fromDate,
    toDate
  );

  return rows.map((r) => ({
    date: r.date,
    batteryTypeId: r.battery_type_id as BatteryId,
    level: r.level,
    capacity: r.capacity,
  }));
}

export async function deleteReadingsBefore(date: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM battery_readings WHERE date < ?', date);
}
