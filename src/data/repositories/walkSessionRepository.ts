import { getDb } from '../db/database';
import type { WalkSession } from '../../types/walk';
import { dateString, daysAgo } from '../../lib/dateUtils';

interface WalkRow {
  id: string;
  date: string;
  started_at: number;
  ended_at: number | null;
  steps: number;
}

function rowToSession(r: WalkRow): WalkSession {
  return {
    id: r.id,
    date: r.date,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    steps: r.steps,
  };
}

export async function startWalk(startedAt: number): Promise<WalkSession> {
  const session: WalkSession = {
    id: `walk_${startedAt}`,
    date: dateString(new Date(startedAt)),
    startedAt,
    endedAt: null,
    steps: 0,
  };
  const db = getDb();
  await db.runAsync(
    `INSERT INTO walk_sessions (id, date, started_at, ended_at, steps) VALUES (?, ?, ?, NULL, 0)`,
    session.id,
    session.date,
    session.startedAt
  );
  return session;
}

export async function getActiveWalk(): Promise<WalkSession | null> {
  const db = getDb();
  const row = await db.getFirstAsync<WalkRow>(
    `SELECT * FROM walk_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1`
  );
  return row ? rowToSession(row) : null;
}

// Save the running step count of an active outing (used on Android, where the
// pedometer cannot be queried for a past time range).
export async function updateWalkSteps(id: string, steps: number): Promise<void> {
  const db = getDb();
  await db.runAsync(`UPDATE walk_sessions SET steps = ? WHERE id = ?`, steps, id);
}

export async function finishWalk(id: string, endedAt: number, steps: number): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `UPDATE walk_sessions SET ended_at = ?, steps = ? WHERE id = ?`,
    endedAt,
    steps,
    id
  );
}

export async function deleteWalk(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync(`DELETE FROM walk_sessions WHERE id = ?`, id);
}

// Outings started within the last `days` days (today included), newest first.
export async function getRecentWalks(days: number): Promise<WalkSession[]> {
  const db = getDb();
  const rows = await db.getAllAsync<WalkRow>(
    `SELECT * FROM walk_sessions WHERE date >= ? ORDER BY started_at DESC`,
    daysAgo(days - 1)
  );
  return rows.map(rowToSession);
}
