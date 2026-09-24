import { getActivityLogForDate } from '../../data/repositories/activityLogRepository';
import { getTrainingLogDay } from '../../data/repositories/trainingLogRepository';
import { planDaySync } from '../../domain/training/trainingLogDaySync';
import type { DaySyncPlan, EntryUpdate } from '../../domain/training/trainingLogDaySync';
import { trainingDaySignature } from '../../domain/training/trainingLogFormatter';
import { parsePageText } from '../../domain/training/trainingLogPageEdit';
import type { WeekNoteEdit } from '../../domain/training/trainingLogPageEdit';
import type { PeriodPage } from '../../domain/training/trainingLogPage';
import type { Language } from '../../i18n/types';
import type { ActivityLogEntry, WorkoutSession } from '../../types/energy';
import type { TrainingLogDayRecord, TrainingLogFormat, TrainingLogPeriod } from '../../types/trainingLog';

// Applies the user's corrections typed on the 📄 page, in two steps so nothing
// that moves a battery happens without the user seeing it first:
//   1. planPageEdit  — reads the edited text, works out every change and how it
//      will be applied (a Xả session recalculated / notebook text only / not
//      applied, with the reason). Writes nothing.
//   2. applyPageEdit — performs the plan and reports what was done, including
//      the day's workout kcal before → after for every recalculated Xả session.
// The writers are injected (stores in the app, fakes in tests).

export type PageChangeTarget =
  | 'xa' // a Xả session's sets changed → kcal & batteries recalculated
  | 'lineText' // only the notebook's text for a day that has Xả sessions
  | 'manualLine' // a hand-written line (no Xả that day) — notebook only
  | 'manualRemoved' // a hand-written day deleted from the notebook
  | 'dayNote'
  | 'weekNote'
  | 'blockName'
  | 'skipped'; // understood, but deliberately not applied (see reason)

export type PageChangeReason =
  | 'unparsed' // part of the line is not lifts/sets → text saved, Xả untouched
  | 'wouldEmpty' // the edit would empty a whole Xả entry (a delete)
  | 'annotationsKept' // Xả updated; "(95 ❌)"-style notes kept in the line
  | 'xaLineRemoved' // a Xả day's line was deleted from the page
  | 'xaLineBlank' // a Xả day's line was emptied
  | 'weightNotSynced' // the weigh-in in "(77.7kg)" changed
  | 'invalidDate' // a day line with a future / impossible date
  | 'titleNotEditable' // a free month's title changed
  | 'failed';

export interface PageChange {
  key: string;
  target: PageChangeTarget;
  date?: string;
  weekLabel?: string;
  before: string;
  after: string;
  reason?: PageChangeReason;
  detail?: string;
  kcalBefore?: number;
  kcalAfter?: number;
}

interface PlannedDay {
  date: string;
  entries: ActivityLogEntry[];
  record: TrainingLogDayRecord | null;
  sync: DaySyncPlan | null; // null = the line itself did not change
  noteAfter: string | null; // null = the note did not change
  deleteRecord: boolean;
  changeKeys: string[]; // the PageChange rows this day produced
}

export interface PageEditPlan {
  changes: PageChange[];
  days: PlannedDay[];
  weekNotes: WeekNoteEdit[];
  rename: { blockId: string; name: string } | null;
}

export interface NotebookDayWrite {
  date: string;
  overrideText: string | null;
  note: string | null;
  sourceSignature: string | null;
}

export interface PageEditWriters {
  updateEntry: (entry: ActivityLogEntry, workouts: WorkoutSession[]) => Promise<void>;
  writeNotebook: (input: {
    days: NotebookDayWrite[];
    deleteDates: string[];
    weeks: { weekStart: string; note: string }[];
  }) => Promise<void>;
  renameBlock: (blockId: string, name: string) => Promise<void>;
}

function workoutKcal(entries: ActivityLogEntry[]): number {
  return Math.round(entries.filter((e) => e.workouts.length > 0).reduce((s, e) => s + e.energyKcal, 0));
}

function hasWorkouts(entries: ActivityLogEntry[]): boolean {
  return entries.some((e) => e.workouts.length > 0);
}

function collapse(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function normalizeNote(text: string): string {
  return text.split('\n').map(collapse).filter(Boolean).join('\n');
}

export async function planPageEdit(input: {
  period: TrainingLogPeriod;
  page: PeriodPage;
  text: string;
  format: TrainingLogFormat;
  language: Language;
  today: string;
}): Promise<PageEditPlan> {
  const { period, page, text, format, language, today } = input;
  const diff = parsePageText({
    page,
    text,
    rangeStart: period.startDate,
    rangeEnd: period.endDate,
    today,
    language,
  });

  const changes: PageChange[] = [];
  const days: PlannedDay[] = [];
  let n = 0;
  const push = (c: Omit<PageChange, 'key'>) => {
    const key = `c${n++}`;
    changes.push({ ...c, key });
    return key;
  };

  if (diff.title) {
    if (period.kind === 'block' && period.blockId && diff.title.after) {
      push({ target: 'blockName', before: diff.title.before, after: diff.title.after });
    } else {
      push({ target: 'skipped', reason: 'titleNotEditable', before: diff.title.before, after: diff.title.after });
    }
  }

  for (const edit of diff.days) {
    const { date, before, after } = edit;
    const [entries, record] = await Promise.all([getActivityLogForDate(date), getTrainingLogDay(date)]);
    const day: PlannedDay = { date, entries, record, sync: null, noteAfter: null, deleteRecord: false, changeKeys: [] };
    const beforeLine = before ? `${before.prefix} ${before.body}`.trim() : '';

    if (!after) {
      if (hasWorkouts(entries)) {
        day.changeKeys.push(push({ target: 'skipped', reason: 'xaLineRemoved', date, before: beforeLine, after: '' }));
      } else {
        day.deleteRecord = true;
        day.changeKeys.push(push({ target: 'manualRemoved', date, before: beforeLine, after: '' }));
      }
      days.push(day);
      continue;
    }

    if ((after.weightKg ?? null) !== (before?.weightKg ?? null)) {
      day.changeKeys.push(
        push({
          target: 'skipped',
          reason: 'weightNotSynced',
          date,
          before: before?.weightKg != null ? String(before.weightKg) : '',
          after: after.weightKg != null ? String(after.weightKg) : '',
        })
      );
    }

    const beforeBody = before?.body ?? '';
    if (collapse(after.body) !== collapse(beforeBody)) {
      const sync = planDaySync({ date, entries, newBody: after.body, format, language });
      day.sync = sync;
      const base = { date, before: beforeBody, after: after.body };
      if (sync.kind === 'manual') {
        day.changeKeys.push(push({ ...base, target: 'manualLine', after: sync.override }));
      } else if (sync.kind === 'blankXa') {
        day.changeKeys.push(push({ ...base, target: 'skipped', reason: 'xaLineBlank' }));
      } else if (sync.kind === 'textOnly') {
        day.changeKeys.push(
          push({ ...base, target: 'lineText', after: sync.override, reason: sync.reason, detail: sync.detail.join(' · ') })
        );
      } else if (sync.updates.length > 0) {
        day.changeKeys.push(
          push({
            ...base,
            target: 'xa',
            kcalBefore: workoutKcal(entries),
            reason: sync.override != null && sync.annotations.length > 0 ? 'annotationsKept' : undefined,
            detail: sync.annotations.length > 0 ? sync.annotations.join(' ') : undefined,
          })
        );
      } else if ((sync.override ?? null) !== (record?.overrideText ?? null)) {
        day.changeKeys.push(push({ ...base, target: 'lineText' }));
      }
    }

    if (normalizeNote(after.note) !== normalizeNote(before?.note ?? '')) {
      day.noteAfter = after.note;
      day.changeKeys.push(push({ target: 'dayNote', date, before: before?.note ?? '', after: after.note }));
    }
    days.push(day);
  }

  for (const line of diff.invalidDates) {
    push({ target: 'skipped', reason: 'invalidDate', before: '', after: line });
  }
  for (const w of diff.weekNotes) {
    push({ target: 'weekNote', weekLabel: w.label, before: w.before, after: w.after });
  }

  const rename =
    diff.title && period.kind === 'block' && period.blockId && diff.title.after
      ? { blockId: period.blockId, name: diff.title.after }
      : null;
  return { changes, days, weekNotes: diff.weekNotes, rename };
}

// True when applying would write anything (the review screen's "Apply").
export function planHasWrites(plan: PageEditPlan): boolean {
  return plan.changes.some((c) => c.target !== 'skipped') || plan.days.some((d) => d.sync?.kind === 'blankXa');
}

export async function applyPageEdit(plan: PageEditPlan, writers: PageEditWriters): Promise<PageChange[]> {
  const byKey = new Map(plan.changes.map((c) => [c.key, { ...c }]));
  const notebookDays: NotebookDayWrite[] = [];
  const deleteDates: string[] = [];

  for (const day of plan.days) {
    if (day.deleteRecord) {
      deleteDates.push(day.date);
      continue;
    }
    const { record, sync } = day;
    let overrideText = record?.overrideText ?? null;
    let sourceSignature = record?.sourceSignature ?? null;

    try {
      if (sync?.kind === 'manual') {
        overrideText = sync.override;
        sourceSignature = null;
      } else if (sync?.kind === 'blankXa') {
        overrideText = null;
        sourceSignature = null;
      } else if (sync?.kind === 'textOnly') {
        // The user's words are the day's line; bind them to the entries as
        // they are, so no "changed since you edited" banner fires for this.
        overrideText = sync.override;
        sourceSignature = trainingDaySignature(day.entries);
      } else if (sync?.kind === 'sync') {
        await applyUpdates(sync.updates, writers);
        const fresh = await getActivityLogForDate(day.date);
        for (const key of day.changeKeys) {
          const change = byKey.get(key)!;
          if (change.target === 'xa') change.kcalAfter = workoutKcal(fresh);
        }
        overrideText = sync.override;
        sourceSignature = sync.override != null ? trainingDaySignature(fresh) : null;
      }
    } catch (e) {
      for (const key of day.changeKeys) {
        const change = byKey.get(key)!;
        if (change.target === 'xa') {
          change.reason = 'failed';
          change.detail = e instanceof Error ? e.message : String(e);
        }
      }
      continue; // leave this day's notebook record as it was
    }

    const note = day.noteAfter != null ? day.noteAfter.trim() || null : (record?.note ?? null);
    const changed =
      overrideText !== (record?.overrideText ?? null) ||
      sourceSignature !== (record?.sourceSignature ?? null) ||
      note !== (record?.note ?? null);
    if (changed) notebookDays.push({ date: day.date, overrideText, note, sourceSignature });
  }

  if (plan.rename) await writers.renameBlock(plan.rename.blockId, plan.rename.name);
  await writers.writeNotebook({
    days: notebookDays,
    deleteDates,
    weeks: plan.weekNotes.map((w) => ({ weekStart: w.weekStart, note: w.after })),
  });

  return plan.changes.map((c) => byKey.get(c.key)!);
}

async function applyUpdates(updates: EntryUpdate[], writers: PageEditWriters) {
  // One at a time: each recalculation reads the batteries the previous wrote.
  for (const u of updates) await writers.updateEntry(u.entry, u.workouts);
}
