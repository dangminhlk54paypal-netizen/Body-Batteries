import { getDb } from '../db/database';
import type { IntakeEvent, BatteryId } from '../../types/battery';

export async function addIntakeEvent(event: IntakeEvent): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO intake_events (id, timestamp, battery_type_id, amount, note)
     VALUES (?, ?, ?, ?, ?)`,
    event.id,
    event.timestamp,
    event.batteryTypeId,
    event.amount,
    event.note
  );
}

export async function getIntakeEventsForDate(date: string): Promise<IntakeEvent[]> {
  const db = getDb();
  // date is YYYY-MM-DD; timestamp is unix ms
  const startMs = new Date(date + 'T00:00:00').getTime();
  const endMs = startMs + 86_400_000;

  const rows = await db.getAllAsync<{
    id: string;
    timestamp: number;
    battery_type_id: string;
    amount: number;
    note: string;
  }>(
    'SELECT * FROM intake_events WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC',
    startMs,
    endMs
  );

  return rows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp,
    batteryTypeId: r.battery_type_id as BatteryId,
    amount: r.amount,
    note: r.note,
  }));
}

export async function getIntakeEventsInRange(
  fromDate: string,
  toDate: string
): Promise<IntakeEvent[]> {
  const db = getDb();
  const startMs = new Date(fromDate + 'T00:00:00').getTime();
  const endMs = new Date(toDate + 'T23:59:59').getTime();

  const rows = await db.getAllAsync<{
    id: string;
    timestamp: number;
    battery_type_id: string;
    amount: number;
    note: string;
  }>(
    'SELECT * FROM intake_events WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC',
    startMs,
    endMs
  );

  return rows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp,
    batteryTypeId: r.battery_type_id as BatteryId,
    amount: r.amount,
    note: r.note,
  }));
}

export async function deleteIntakeEventsBefore(date: string): Promise<void> {
  const db = getDb();
  const cutoffMs = new Date(date + 'T00:00:00').getTime();
  await db.runAsync('DELETE FROM intake_events WHERE timestamp < ?', cutoffMs);
}
