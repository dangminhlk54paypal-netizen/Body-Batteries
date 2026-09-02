import { getDb } from '../db/database';
import type { GeneratedBlockPlan, TrainingBlockConfig, BlockWeekPlan } from '../../types/powerliftingBlock';

interface TrainingBlockRow {
  id: string;
  created_at: number;
  progressive_weeks: number;
  has_deload: number;
  focus: string;
  body_weight_kg: number;
  deficit_mode_enabled: number;
  is_active: number;
  config: string;
  weeks: string;
}

function rowToPlan(r: TrainingBlockRow): GeneratedBlockPlan {
  return {
    config: JSON.parse(r.config) as TrainingBlockConfig,
    weeks: JSON.parse(r.weeks) as BlockWeekPlan[],
  };
}

// A new block replaces whichever one was active — "today's planned session"
// lookups (see PowerliftingSheet prefill, Phase 4) only ever want ONE
// candidate block, never a set the caller has to disambiguate.
export async function addTrainingBlock(plan: GeneratedBlockPlan): Promise<void> {
  const db = getDb();
  const { config } = plan;
  await db.execAsync('UPDATE training_blocks SET is_active = 0 WHERE is_active = 1');
  await db.runAsync(
    `INSERT INTO training_blocks
       (id, created_at, progressive_weeks, has_deload, focus, body_weight_kg, deficit_mode_enabled, is_active, config, weeks)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    config.id,
    config.createdAt,
    config.progressiveWeeks,
    config.hasDeload ? 1 : 0,
    config.focus,
    config.bodyWeightKg,
    config.deficitModeEnabled ? 1 : 0,
    JSON.stringify(config),
    JSON.stringify(plan.weeks)
  );
}

export async function getActiveTrainingBlock(): Promise<GeneratedBlockPlan | null> {
  const db = getDb();
  const row = await db.getFirstAsync<TrainingBlockRow>(
    'SELECT * FROM training_blocks WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1'
  );
  return row ? rowToPlan(row) : null;
}

export async function getTrainingBlockById(id: string): Promise<GeneratedBlockPlan | null> {
  const db = getDb();
  const row = await db.getFirstAsync<TrainingBlockRow>('SELECT * FROM training_blocks WHERE id = ?', id);
  return row ? rowToPlan(row) : null;
}

// Most recent first — for a future "past blocks" history screen.
export async function listTrainingBlocks(): Promise<GeneratedBlockPlan[]> {
  const db = getDb();
  const rows = await db.getAllAsync<TrainingBlockRow>(
    'SELECT * FROM training_blocks ORDER BY created_at DESC'
  );
  return rows.map(rowToPlan);
}

export async function updateTrainingBlock(plan: GeneratedBlockPlan): Promise<void> {
  const db = getDb();
  const { config } = plan;
  await db.runAsync(
    `UPDATE training_blocks
     SET progressive_weeks = ?, has_deload = ?, focus = ?, body_weight_kg = ?,
         deficit_mode_enabled = ?, config = ?, weeks = ?
     WHERE id = ?`,
    config.progressiveWeeks,
    config.hasDeload ? 1 : 0,
    config.focus,
    config.bodyWeightKg,
    config.deficitModeEnabled ? 1 : 0,
    JSON.stringify(config),
    JSON.stringify(plan.weeks),
    config.id
  );
}

export async function deleteTrainingBlock(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM training_blocks WHERE id = ?', id);
}
