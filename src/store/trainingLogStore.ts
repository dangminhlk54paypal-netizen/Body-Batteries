import { create } from 'zustand';
import { useSettingsStore } from './settingsStore';
import { getCurrentLanguage } from '../i18n';
import { todayString } from '../lib/dateUtils';
import { buildTrainingLogIndex } from '../domain/training/trainingLogIndex';
import { formatDayLine, normalizeManualBody } from '../domain/training/trainingLogFormatter';
import {
  getActivityLogForDate,
  getLatestTrainingDateBefore,
  getTrainingDayCounts,
} from '../data/repositories/activityLogRepository';
import { listTrainingBlocks } from '../data/repositories/trainingBlockRepository';
import { deleteLiftMax, insertLiftMax, listLiftMaxes } from '../data/repositories/liftMaxRepository';
import {
  deleteTrainingLogDay,
  getLatestTrainingLogDayBefore,
  getTrainingLogDay,
  getTrainingLogWeek,
  listTrainingLogDates,
  listTrainingLogMonthNames,
  listTrainingLogWeekLabels,
  listTrainingLogWeekStarts,
  setTrainingLogMonthName,
  upsertTrainingLogDay,
  upsertTrainingLogWeek,
} from '../data/repositories/trainingLogRepository';
import { resolveTrainingLogFormat } from '../types/trainingLog';
import type { LiftMaxRecord, TrainingLogDayRecord, TrainingLogPeriod } from '../types/trainingLog';
import type { LiftingExercise } from '../types/energy';

// Store behind the Tập luyện tab's "Sổ tập". No `persist`: SQLite is the source
// of truth (same convention as blockStore/energyStore). It holds only the
// block → week → day INDEX; a week's actual lines are loaded by the week
// section when it is expanded, and reload whenever `revision` changes — every
// write and every focus bumps it, so an open week never shows stale text.
//
// Everything here writes ONLY the user's additions (training_log_* tables).
// It never touches activity_log, so nothing in this store can move a battery.
interface TrainingLogState {
  periods: TrainingLogPeriod[];
  // The user's recorded one-rep maxes, oldest first (⭐ on the strength chart).
  liftMaxes: LiftMaxRecord[];
  loaded: boolean;
  revision: number;
  loadIndex: () => Promise<void>;
  // A HAND-WRITTEN line for a day the user forgot to Xả (no signature). `note`
  // replaces the day's note (blank clears it).
  saveManualDay: (date: string, body: string, note: string) => Promise<void>;
  // The user's rewrite of an auto line; `signature` = what the day's entries
  // looked like when they edited it.
  saveDayOverride: (date: string, body: string, signature: string) => Promise<void>;
  // Back to the auto-generated line. Keeps the day's note.
  clearDayOverride: (date: string) => Promise<void>;
  // "Keep my line": re-bind the user's text to the entries as they are now.
  acceptCurrentSignature: (date: string, signature: string) => Promise<void>;
  // "Merge": the user's text followed by the current auto body.
  mergeAutoIntoOverride: (date: string, autoBody: string, signature: string) => Promise<void>;
  saveDayNote: (date: string, note: string) => Promise<void>;
  // Drops the day's whole log record (line + note). Auto lines from Xả return.
  deleteDay: (date: string) => Promise<void>;
  saveWeekNote: (weekStart: string, note: string) => Promise<void>;
  // Many day/week records in one go (the 📄 page editor), then ONE reload.
  // Records are written as given (the caller already normalized them).
  writeNotebook: (input: {
    days: Omit<TrainingLogDayRecord, 'updatedAt'>[];
    deleteDates: string[];
    // Only the given fields change: a note edit keeps the week's label and
    // the other way round.
    weeks: { weekStart: string; note?: string; label?: string }[];
  }) => Promise<void>;
  // A free month's own name ("Power Lifting"); blank = back to "Tập tự do · …".
  renameMonth: (monthKey: string, name: string) => Promise<void>;
  addLiftMax: (input: { lift: LiftingExercise; weightKg: number; date: string; note: string }) => Promise<void>;
  deleteLiftMax: (id: string) => Promise<void>;
  // Body of the closest earlier day that has content (a hand-written/edited
  // line, or a Xả session), for the editor's "copy latest session".
  findPreviousDayBody: (beforeDate: string) => Promise<string | null>;
}

function currentFormat() {
  return resolveTrainingLogFormat(useSettingsStore.getState().trainingLogFormat);
}

export const useTrainingLogStore = create<TrainingLogState>((set, get) => {
  async function writeDay(
    date: string,
    change: (existing: TrainingLogDayRecord | null) => Omit<TrainingLogDayRecord, 'date' | 'updatedAt'>
  ) {
    const existing = await getTrainingLogDay(date);
    await upsertTrainingLogDay({ date, ...change(existing), updatedAt: Date.now() });
    await get().loadIndex();
  }

  async function writeWeek(w: { weekStart: string; note?: string; label?: string }, updatedAt: number) {
    const existing = await getTrainingLogWeek(w.weekStart);
    await upsertTrainingLogWeek({
      weekStart: w.weekStart,
      note: w.note !== undefined ? w.note : (existing?.note ?? null),
      label: w.label !== undefined ? w.label : (existing?.label ?? null),
      updatedAt,
    });
  }

  return {
    periods: [],
    liftMaxes: [],
    loaded: false,
    revision: 0,

    loadIndex: async () => {
      const [trainingDays, logDates, weekNoteStarts, blocks, weekLabels, monthNames, liftMaxes] = await Promise.all([
        getTrainingDayCounts(),
        listTrainingLogDates(),
        listTrainingLogWeekStarts(),
        listTrainingBlocks(),
        listTrainingLogWeekLabels(),
        listTrainingLogMonthNames(),
        listLiftMaxes(),
      ]);
      const periods = buildTrainingLogIndex({
        trainingDays,
        logDates,
        weekNoteStarts,
        blocks,
        today: todayString(),
        weekLabels,
        monthNames,
      });
      set((s) => ({ periods, liftMaxes, loaded: true, revision: s.revision + 1 }));
    },

    saveManualDay: (date, body, note) =>
      writeDay(date, () => ({
        overrideText: normalizeManualBody(body, currentFormat()),
        note,
        sourceSignature: null,
      })),

    saveDayOverride: (date, body, signature) =>
      writeDay(date, (existing) => ({
        overrideText: normalizeManualBody(body, currentFormat()),
        note: existing?.note ?? null,
        sourceSignature: signature,
      })),

    clearDayOverride: (date) =>
      writeDay(date, (existing) => ({
        overrideText: null,
        note: existing?.note ?? null,
        sourceSignature: null,
      })),

    acceptCurrentSignature: (date, signature) =>
      writeDay(date, (existing) => ({
        overrideText: existing?.overrideText ?? null,
        note: existing?.note ?? null,
        sourceSignature: signature,
      })),

    mergeAutoIntoOverride: (date, autoBody, signature) =>
      writeDay(date, (existing) => ({
        overrideText: [existing?.overrideText, autoBody]
          .filter((p): p is string => !!p && p.trim() !== '')
          .join(' '),
        note: existing?.note ?? null,
        sourceSignature: signature,
      })),

    saveDayNote: (date, note) =>
      writeDay(date, (existing) => ({
        overrideText: existing?.overrideText ?? null,
        note,
        sourceSignature: existing?.sourceSignature ?? null,
      })),

    deleteDay: async (date) => {
      await deleteTrainingLogDay(date);
      await get().loadIndex();
    },

    saveWeekNote: async (weekStart, note) => {
      await writeWeek({ weekStart, note }, Date.now());
      await get().loadIndex();
    },

    addLiftMax: async ({ lift, weightKg, date, note }) => {
      const createdAt = Date.now();
      await insertLiftMax({
        id: `max_${createdAt}_${Math.round(Math.random() * 1e6)}`,
        lift,
        weightKg,
        date,
        note: note.trim() || null,
        createdAt,
      });
      await get().loadIndex();
    },

    deleteLiftMax: async (id) => {
      await deleteLiftMax(id);
      await get().loadIndex();
    },

    renameMonth: async (monthKey, name) => {
      await setTrainingLogMonthName(monthKey, name);
      await get().loadIndex();
    },

    writeNotebook: async ({ days, deleteDates, weeks }) => {
      const now = Date.now();
      for (const d of days) await upsertTrainingLogDay({ ...d, updatedAt: now });
      for (const date of deleteDates) await deleteTrainingLogDay(date);
      for (const w of weeks) await writeWeek(w, now);
      await get().loadIndex();
    },

    findPreviousDayBody: async (beforeDate) => {
      const [xaDate, logDay] = await Promise.all([
        getLatestTrainingDateBefore(beforeDate),
        getLatestTrainingLogDayBefore(beforeDate),
      ]);
      // The user's own words win a tie: an edited/hand-written line on the same
      // day as a Xả session is what the notebook shows.
      if (logDay?.overrideText && (!xaDate || logDay.date >= xaDate)) return logDay.overrideText;
      if (!xaDate) return null;
      const entries = await getActivityLogForDate(xaDate);
      const { body } = formatDayLine({
        date: xaDate,
        entries,
        format: currentFormat(),
        language: getCurrentLanguage(),
      });
      return body === '' ? null : body;
    },
  };
});
