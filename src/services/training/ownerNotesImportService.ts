import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActivityLogForDate } from '../../data/repositories/activityLogRepository';
import { setFirstWeightInRange, setWeightForDay } from '../../data/repositories/healthSignalsRepository';
import {
  OWNER_NOTES_IMPORT_LANGUAGE,
  OWNER_NOTES_IMPORT_TEXT,
  buildOwnerImportPeriod,
  keepUnmentionedMovements,
} from '../../domain/training/ownerNotesImport';
import { backfillTimestamp } from '../../domain/training/trainingLogDaySync';
import { weighInTimestamp } from '../../domain/health/weighIn';
import { todayString } from '../../lib/dateUtils';
import { useEnergyStore } from '../../store/energyStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTrainingLogStore } from '../../store/trainingLogStore';
import { resolveTrainingLogFormat } from '../../types/trainingLog';
import { applyPageEdit, planPageEdit } from './trainingLogPageSync';

// TEMPORARY — runs the owner's one-time Notes import (see
// domain/training/ownerNotesImport.ts) once, at startup. Safe to re-run: a day
// the import already logged reads back as unchanged, so a crash halfway just
// finishes on the next launch. The marker is only set after a full run.

const MARKER_KEY = 'ownerNotesImport.v1.done';
// Only the owner runs the preview build in this window; nothing runs after it,
// so this can never reach anyone else even if the removal is forgotten.
const LAST_RUN_DAY = '2026-10-15';
const DAY_LINE = /^(\d{2}\.\d{2}):\s*(.*)$/;

export async function runOwnerNotesImportOnce(): Promise<void> {
  try {
    const today = todayString();
    if (today > LAST_RUN_DAY) return;
    if (await AsyncStorage.getItem(MARKER_KEY)) return;

    const language = OWNER_NOTES_IMPORT_LANGUAGE;
    const format = resolveTrainingLogFormat(useSettingsStore.getState().trainingLogFormat);
    const { period, page } = buildOwnerImportPeriod(language);

    // A day that already has Xả keeps the lifts the import line does not mention.
    const lines: string[] = [];
    for (const line of OWNER_NOTES_IMPORT_TEXT.split('\n')) {
      const m = line.match(DAY_LINE);
      if (!m) {
        lines.push(line);
        continue;
      }
      const date = `2026-${m[1].slice(3, 5)}-${m[1].slice(0, 2)}`;
      const body = keepUnmentionedMovements(m[2], await getActivityLogForDate(date), format, language);
      lines.push(`${m[1]}: ${body}`);
    }

    const plan = await planPageEdit({ period, page, text: lines.join('\n'), format, language, today });
    const energy = useEnergyStore.getState();
    const notebook = useTrainingLogStore.getState();
    const done = await applyPageEdit(plan, {
      updateEntry: (entry, workouts) => energy.updateActivityForPastDate(entry, { workouts }),
      createEntry: (date, workouts) => energy.logActivityForPastDate({ workouts }, backfillTimestamp(date, Date.now())),
      writeNotebook: notebook.writeNotebook,
      renameMonth: notebook.renameMonth,
      setDayWeight: (date, kg) => setWeightForDay(date, kg, weighInTimestamp(date, Date.now())),
      setWeekWeight: (weekStart, weekEnd, kg) =>
        setFirstWeightInRange(weekStart, weekEnd, kg, weighInTimestamp(weekStart, Date.now())),
    });

    const byTarget = new Map<string, number>();
    for (const c of done) {
      const key = c.reason ? `${c.target}:${c.reason}` : c.target;
      byTarget.set(key, (byTarget.get(key) ?? 0) + 1);
    }
    console.log('[ownerNotesImport] done', Object.fromEntries(byTarget));
    await AsyncStorage.setItem(MARKER_KEY, today);
  } catch (e) {
    console.warn('[ownerNotesImport] failed — retried on next launch', e);
  }
}
