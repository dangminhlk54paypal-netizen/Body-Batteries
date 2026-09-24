import { getActivityLogForDate } from '../../data/repositories/activityLogRepository';
import { getTrainingLogDay } from '../../data/repositories/trainingLogRepository';
import { planDaySync } from '../../domain/training/trainingLogDaySync';
import type { DaySyncPlan, EntryUpdate } from '../../domain/training/trainingLogDaySync';
import { formatDefaultFreeTitle, trainingDaySignature } from '../../domain/training/trainingLogFormatter';
import { parsePageText } from '../../domain/training/trainingLogPageEdit';
import { isValidBodyWeight } from '../../domain/health/weighIn';
import type { DayEdit, WeekLabelEdit, WeekNoteEdit, WeekWeightEdit } from '../../domain/training/trainingLogPageEdit';
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
  | 'xaCreate' // a day without Xả whose line reads fully → a new Xả session (kcal & batteries)
  | 'lineText' // only the notebook's text for a day that has Xả sessions
  | 'manualLine' // a hand-written line (no Xả that day) — notebook only
  | 'manualRemoved' // a hand-written day deleted from the notebook
  | 'dayNote'
  | 'weight' // "14.09(79.5kg):" — that day's weigh-in (the body-weight log)
  | 'weekWeight' // "07.09–13.09 80kg" — the week's (first) weigh-in
  | 'weekNote'
  | 'weekLabel' // the user's own week name ("B3W3") in front of the dates
  | 'blockName'
  | 'monthName' // a free month's own name ("Power Lifting")
  | 'skipped'; // understood, but deliberately not applied (see reason)

export type PageChangeReason =
  | 'unparsed' // part of the line is not lifts/sets → text saved, Xả untouched
  | 'unparsedManual' // a day without Xả: part of the line is not lifts/sets → no session created
  | 'wouldEmpty' // the edit would empty a whole Xả entry (a delete)
  | 'annotationsKept' // Xả updated; "(95 ❌)"-style notes kept in the line
  | 'xaLineRemoved' // a Xả day's line was deleted from the page
  | 'xaLineBlank' // a Xả day's line was emptied
  | 'weightNotSynced' // a weigh-in was removed from "(77.7kg)" — the page never deletes one
  | 'weightInvalid' // "(7.5kg)": outside the range a body weight can be
  | 'invalidDate' // a day line with a future / impossible date
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
  weightAfter: number | null; // the day's weigh-in to save; null = none typed/changed
  deleteRecord: boolean;
  changeKeys: string[]; // the PageChange rows this day produced
}

export type PeriodRename =
  | { kind: 'block'; blockId: string; name: string }
  | { kind: 'month'; monthKey: string; name: string }; // '' = back to the default title

export interface PageEditPlan {
  changes: PageChange[];
  days: PlannedDay[];
  weekNotes: WeekNoteEdit[];
  weekLabels: WeekLabelEdit[];
  weekWeights: (WeekWeightEdit & { key: string })[]; // valid ones only
  rename: PeriodRename | null;
}

export interface NotebookDayWrite {
  date: string;
  overrideText: string | null;
  note: string | null;
  sourceSignature: string | null;
}

export interface PageEditWriters {
  updateEntry: (entry: ActivityLogEntry, workouts: WorkoutSession[]) => Promise<void>;
  // A new Xả session on a past (or today's) day — energyStore.logActivityForPastDate.
  createEntry: (date: string, workouts: WorkoutSession[]) => Promise<void>;
  writeNotebook: (input: {
    days: NotebookDayWrite[];
    deleteDates: string[];
    // Only the fields given change; the other one keeps what is stored.
    weeks: { weekStart: string; note?: string; label?: string }[];
  }) => Promise<void>;
  renameBlock: (blockId: string, name: string) => Promise<void>;
  renameMonth: (monthKey: string, name: string) => Promise<void>;
  // The day's weigh-in (healthSignalsRepository.setWeightForDay).
  setDayWeight: (date: string, kg: number) => Promise<void>;
  // The week heading's weight: the week's first weigh-in takes it, else one is
  // added on its Monday.
  setWeekWeight: (weekStart: string, weekEnd: string, kg: number) => Promise<void>;
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
  // "Ghi dòng tay vào Xả": also turn every UNCHANGED hand-written line of the
  // period into a Xả session (a month of workouts written before this existed).
  backfillManual?: boolean;
}): Promise<PageEditPlan> {
  const { period, page, text, format, language, today, backfillManual } = input;
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

  let rename: PeriodRename | null = null;
  if (diff.title && diff.title.after) {
    if (period.kind === 'block' && period.blockId) {
      rename = { kind: 'block', blockId: period.blockId, name: diff.title.after };
      push({ target: 'blockName', before: diff.title.before, after: diff.title.after });
    } else if (period.kind === 'free' && period.monthKey) {
      // Typing the default title back ("Tập tự do · tháng 9 năm 2026") clears the name.
      const isDefault = collapse(diff.title.after) === collapse(formatDefaultFreeTitle(period, language));
      rename = { kind: 'month', monthKey: period.monthKey, name: isDefault ? '' : diff.title.after };
      push({ target: 'monthName', before: diff.title.before, after: diff.title.after });
    }
  }

  const edits: (DayEdit & { backfill?: boolean })[] = [...diff.days];
  if (backfillManual) {
    const edited = new Set(diff.days.map((d) => d.date));
    for (const d of page.days) {
      if (edited.has(d.date) || !d.body) continue;
      edits.push({ date: d.date, before: d, after: { date: d.date, body: d.body, note: d.note, weightKg: d.weightKg }, backfill: true });
    }
    edits.sort((a, b) => a.date.localeCompare(b.date));
  }

  for (const edit of edits) {
    const { date, before, after } = edit;
    const [entries, record] = await Promise.all([getActivityLogForDate(date), getTrainingLogDay(date)]);
    // Backfill only touches hand-written lines: a day with Xả already has its session.
    if (edit.backfill && (hasWorkouts(entries) || record?.overrideText == null)) continue;
    const day: PlannedDay = {
      date,
      entries,
      record,
      sync: null,
      noteAfter: null,
      weightAfter: null,
      deleteRecord: false,
      changeKeys: [],
    };
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
      const weight = {
        date,
        before: before?.weightKg != null ? String(before.weightKg) : '',
        after: after.weightKg != null ? String(after.weightKg) : '',
      };
      // A weight typed in front of a day ("14.09(79.5kg):") is that day's
      // weigh-in — how weights from old notes reach the strength chart.
      if (after.weightKg == null) {
        day.changeKeys.push(push({ ...weight, target: 'skipped', reason: 'weightNotSynced' }));
      } else if (!isValidBodyWeight(after.weightKg)) {
        day.changeKeys.push(push({ ...weight, target: 'skipped', reason: 'weightInvalid' }));
      } else {
        day.weightAfter = after.weightKg;
        day.changeKeys.push(push({ ...weight, target: 'weight' }));
      }
    }

    const beforeBody = before?.body ?? '';
    if (edit.backfill || collapse(after.body) !== collapse(beforeBody)) {
      const sync = planDaySync({ date, entries, newBody: after.body, format, language });
      day.sync = sync;
      const base = { date, before: beforeBody, after: after.body };
      const unparsedDetail = sync.kind === 'manual' ? sync.unparsed.join(' · ') : '';
      if (edit.backfill && sync.kind !== 'create') {
        // Unchanged text that can't become a session: say why, write nothing.
        day.sync = null;
        day.changeKeys.push(push({ ...base, target: 'skipped', reason: 'unparsedManual', detail: unparsedDetail }));
      } else if (sync.kind === 'create') {
        day.changeKeys.push(
          push({
            ...base,
            before: edit.backfill ? '' : beforeBody,
            target: 'xaCreate',
            kcalBefore: 0,
            detail: sync.annotations.length > 0 ? sync.annotations.join(' ') : undefined,
            reason: sync.override != null && sync.annotations.length > 0 ? 'annotationsKept' : undefined,
          })
        );
      } else if (sync.kind === 'manual') {
        day.changeKeys.push(
          push({
            ...base,
            target: 'manualLine',
            after: sync.override,
            reason: sync.unparsed.length > 0 ? 'unparsedManual' : undefined,
            detail: unparsedDetail || undefined,
          })
        );
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
  for (const w of diff.weekLabels) {
    push({ target: 'weekLabel', weekLabel: w.range, before: w.before, after: w.after });
  }
  for (const w of diff.weekNotes) {
    push({ target: 'weekNote', weekLabel: w.label, before: w.before, after: w.after });
  }
  const weekWeights: PageEditPlan['weekWeights'] = [];
  for (const w of diff.weekWeights) {
    const change = { weekLabel: w.label, before: w.before != null ? String(w.before) : '', after: String(w.after) };
    if (!isValidBodyWeight(w.after)) {
      push({ ...change, target: 'skipped', reason: 'weightInvalid' });
    } else {
      weekWeights.push({ ...w, key: push({ ...change, target: 'weekWeight' }) });
    }
  }

  return { changes, days, weekNotes: diff.weekNotes, weekLabels: diff.weekLabels, weekWeights, rename };
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
    if (day.weightAfter != null) {
      try {
        await writers.setDayWeight(day.date, day.weightAfter);
      } catch (e) {
        for (const key of day.changeKeys) {
          const change = byKey.get(key)!;
          if (change.target === 'weight') {
            change.reason = 'failed';
            change.detail = e instanceof Error ? e.message : String(e);
          }
        }
      }
    }
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
      } else if (sync?.kind === 'create') {
        const created = await createDaySession(day.date, sync, writers);
        for (const key of day.changeKeys) {
          const change = byKey.get(key)!;
          if (change.target === 'xaCreate') change.kcalAfter = created.kcal;
        }
        overrideText = created.overrideText;
        sourceSignature = created.sourceSignature;
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
        if (change.target === 'xa' || change.target === 'xaCreate') {
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

  if (plan.rename?.kind === 'block') await writers.renameBlock(plan.rename.blockId, plan.rename.name);
  if (plan.rename?.kind === 'month') await writers.renameMonth(plan.rename.monthKey, plan.rename.name);

  // A week can get a new note and a new label in the same edit: one write each.
  const weeks = new Map<string, { weekStart: string; note?: string; label?: string }>();
  const weekWrite = (weekStart: string) => {
    const w = weeks.get(weekStart) ?? { weekStart };
    weeks.set(weekStart, w);
    return w;
  };
  for (const w of plan.weekNotes) weekWrite(w.weekStart).note = w.after;
  for (const w of plan.weekLabels) weekWrite(w.weekStart).label = w.after;
  for (const w of plan.weekWeights) {
    try {
      await writers.setWeekWeight(w.weekStart, w.weekEnd, w.after);
    } catch (e) {
      const change = byKey.get(w.key)!;
      change.reason = 'failed';
      change.detail = e instanceof Error ? e.message : String(e);
    }
  }
  await writers.writeNotebook({ days: notebookDays, deleteDates, weeks: [...weeks.values()] });

  return plan.changes.map((c) => byKey.get(c.key)!);
}

// Logs the planned session, then says how the notebook should hold the day:
// no override when the auto line now prints what the user wrote, else the
// user's text bound to the new entry (no "changed since you edited" banner).
async function createDaySession(
  date: string,
  plan: Extract<DaySyncPlan, { kind: 'create' }>,
  writers: Pick<PageEditWriters, 'createEntry'>
): Promise<{ kcal: number; overrideText: string | null; sourceSignature: string | null }> {
  await writers.createEntry(date, plan.workouts);
  const fresh = await getActivityLogForDate(date);
  return {
    kcal: workoutKcal(fresh),
    overrideText: plan.override,
    sourceSignature: plan.override != null ? trainingDaySignature(fresh) : null,
  };
}

// The "＋ Ghi buổi" editor's save for a day without Xả whose line reads fully:
// the same session creation the page editor does, plus the day's note.
// Returns the new session's kcal.
export async function saveLineAsXa(
  input: { date: string; plan: Extract<DaySyncPlan, { kind: 'create' }>; note: string },
  writers: Pick<PageEditWriters, 'createEntry' | 'writeNotebook'>
): Promise<number> {
  const created = await createDaySession(input.date, input.plan, writers);
  await writers.writeNotebook({
    days: [
      {
        date: input.date,
        overrideText: created.overrideText,
        note: input.note.trim() || null,
        sourceSignature: created.sourceSignature,
      },
    ],
    deleteDates: [],
    weeks: [],
  });
  return created.kcal;
}

async function applyUpdates(updates: EntryUpdate[], writers: PageEditWriters) {
  // One at a time: each recalculation reads the batteries the previous wrote.
  for (const u of updates) await writers.updateEntry(u.entry, u.workouts);
}
