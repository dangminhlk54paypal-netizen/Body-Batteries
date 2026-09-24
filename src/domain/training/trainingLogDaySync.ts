import { estimateLiftingMinutes } from '../energy/liftingEngine';
import type { Language } from '../../i18n/types';
import type { ActivityLogEntry, LiftingSet, WorkoutSession } from '../../types/energy';
import type { TrainingLogFormat } from '../../types/trainingLog';
import { formatDayLine, formatMovement, formatSetSequence, normalizeManualBody } from './trainingLogFormatter';
import { identityOfWorkout, parseDayBody, sameIdentity, stripKcalSuffix } from './trainingLogParser';
import type { ParsedMovement } from './trainingLogParser';

// What a corrected day line (typed on the 📄 page) means for the day's Xả
// entries. Pure: it only PLANS — the service applies the plan through
// energyStore.updateActivityForPastDate, which recalculates kcal and the
// batteries exactly as if the session had been logged right the first time.
//
// Conservative by design. The line is matched movement by movement against
// what the entries print today:
//   - a movement written exactly as before keeps its session untouched (warm-ups,
//     minutes, bodybuilding data and all);
//   - a lift whose numbers changed gets its sets rebuilt from the text;
//   - a lift that disappeared from the line is removed from its entry.
// If ANY part of the line cannot be read as lifts and sets, nothing in Xả is
// touched: the text is kept as the user's own line, and the UI says why.

export interface EntryUpdate {
  entry: ActivityLogEntry;
  workouts: WorkoutSession[];
}

export type DaySyncPlan =
  // No Xả entry behind this day: the line lives only in the notebook.
  | { kind: 'manual'; override: string }
  // The line was emptied but Xả has sessions: Xả is never deleted from here.
  | { kind: 'blankXa' }
  // Could not be applied to Xả; the text is still saved as the user's line.
  | { kind: 'textOnly'; override: string; reason: 'unparsed' | 'wouldEmpty'; detail: string[] }
  | {
      kind: 'sync';
      updates: EntryUpdate[]; // only entries whose workouts actually change
      // null = the auto line now says exactly what the user wrote → no override.
      // Otherwise the user's text is kept (annotations like "(95 ❌)", own spelling).
      override: string | null;
      annotations: string[];
    };

function whenOf(e: ActivityLogEntry): number {
  return e.startAt ?? e.timestamp;
}

function collapse(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

interface OldMovement {
  entryIdx: number;
  workout: WorkoutSession;
  text: string;
}

interface Piece {
  pos: number;
  old?: OldMovement;
  parsed?: ParsedMovement;
}

function isBoundary(ch: string | undefined): boolean {
  return ch === undefined || /\s/.test(ch) || ch === '·';
}

// Finds `needle` in `haystack` as a whole movement (not inside a longer one:
// "B 90 5x5x72.5" must not match inside "B 90 5x5x72.5+3x80"), outside `taken`.
function findWhole(haystack: string, needle: string, taken: boolean[]): number {
  let from = 0;
  for (;;) {
    const i = haystack.indexOf(needle, from);
    if (i < 0) return -1;
    const end = i + needle.length;
    const free = !taken.slice(i, end).some(Boolean);
    if (free && isBoundary(haystack[i - 1]) && isBoundary(haystack[end])) return i;
    from = i + 1;
  }
}

function sameSets(a: LiftingSet[], b: LiftingSet[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function planDaySync(input: {
  date: string;
  entries: ActivityLogEntry[]; // the day's Xả entries
  newBody: string; // what the user wrote after "dd.mm:"
  format: TrainingLogFormat;
  language: Language;
}): DaySyncPlan {
  const { date, format, language } = input;
  const entries = input.entries
    .filter((e) => e.workouts.length > 0)
    .sort((a, b) => whenOf(a) - whenOf(b) || a.id.localeCompare(b.id));
  const body = collapse(stripKcalSuffix(input.newBody, language));
  const override = normalizeManualBody(body, format);

  if (entries.length === 0) return { kind: 'manual', override };
  if (body === '') return { kind: 'blankXa' };

  const old: OldMovement[] = entries.flatMap((entry, entryIdx) =>
    entry.workouts.map((workout) => ({ entryIdx, workout, text: formatMovement(workout, format, language) }))
  );

  // 1. Movements written exactly as the entries print them are kept as-is.
  const taken = new Array<boolean>(body.length).fill(false);
  const pieces: Piece[] = [];
  const unmatched: OldMovement[] = [];
  for (const o of old) {
    const at = o.text ? findWhole(body, o.text, taken) : -1;
    if (at < 0) {
      unmatched.push(o);
      continue;
    }
    for (let i = at; i < at + o.text.length; i++) taken[i] = true;
    pieces.push({ pos: at, old: o });
  }

  // 2. Everything else is read as notation.
  const annotations: string[] = [];
  const problems: string[] = [];
  const known = entries.flatMap((e) => e.workouts);
  let gapStart = -1;
  for (let i = 0; i <= body.length; i++) {
    const inGap = i < body.length && !taken[i];
    if (inGap && gapStart < 0) gapStart = i;
    if (!inGap && gapStart >= 0) {
      const gap = body.slice(gapStart, i);
      if (gap.trim() !== '') {
        const parsed = parseDayBody(gap, { format, language, known });
        annotations.push(...parsed.annotations);
        problems.push(...parsed.unparsed);
        parsed.movements.forEach((m, k) => {
          if (!m.identity) problems.push(m.text);
          pieces.push({ pos: gapStart + k / 1000, parsed: m });
        });
      }
      gapStart = -1;
    }
  }
  if (problems.length > 0) return { kind: 'textOnly', override, reason: 'unparsed', detail: problems };

  // 3. Rebuild each entry's workouts in the order the line lists them.
  const firstLifting = Math.max(
    0,
    entries.findIndex((e) => e.workouts.some((w) => identityOfWorkout(w) != null))
  );
  const next: WorkoutSession[][] = entries.map(() => []);
  let lastEntry = firstLifting;
  for (const piece of pieces.sort((a, b) => a.pos - b.pos)) {
    if (piece.old) {
      next[piece.old.entryIdx].push(piece.old.workout);
      lastEntry = piece.old.entryIdx;
      continue;
    }
    const m = piece.parsed!;
    const identity = m.identity!;
    // The session this movement rewrites: the first unmatched one of the same lift.
    const replacedAt = unmatched.findIndex((o) => {
      const id = identityOfWorkout(o.workout);
      return id != null && sameIdentity(id, identity);
    });
    const replaced = replacedAt >= 0 ? unmatched.splice(replacedAt, 1)[0] : undefined;
    const oldWarmups = replaced?.workout.sets?.filter((s) => s.kind === 'warmup') ?? [];

    // With warm-ups shown, the first chain may be the (unchanged) warm-up ramp.
    let working = m.sets;
    if (format.showWarmups && oldWarmups.length > 0 && m.chains.length > 1) {
      const ramp = formatSetSequence(oldWarmups, format, language);
      if (collapse(m.chains[0].raw) === ramp) {
        working = m.chains.slice(1).flatMap((c) => c.sets.map((s) => ({ kind: 'working' as const, ...s })));
      }
    }
    const sets = [...oldWarmups, ...working];
    const entryIdx = replaced?.entryIdx ?? lastEntry;
    if (replaced?.workout.sets && sameSets(replaced.workout.sets, sets)) {
      next[entryIdx].push(replaced.workout);
    } else {
      const session: WorkoutSession = {
        type: identity.exercise,
        minutes: estimateLiftingMinutes(sets),
        sets,
      };
      if (identity.variationName) session.variationName = identity.variationName;
      else if (identity.variationId) session.variationId = identity.variationId;
      next[entryIdx].push(session);
    }
    lastEntry = entryIdx;
  }

  const updates: EntryUpdate[] = [];
  for (let i = 0; i < entries.length; i++) {
    if (JSON.stringify(next[i]) === JSON.stringify(entries[i].workouts)) continue;
    // Emptying a whole Xả entry is a delete — that belongs to History, not here.
    if (next[i].length === 0) {
      return {
        kind: 'textOnly',
        override,
        reason: 'wouldEmpty',
        detail: entries[i].workouts.map((w) => formatMovement(w, format, language)),
      };
    }
    updates.push({ entry: entries[i], workouts: next[i] });
  }

  const nextEntries = entries.map((e, i) => ({ ...e, workouts: next[i] }));
  const autoBody = formatDayLine({
    date,
    entries: nextEntries,
    format: { ...format, showKcal: false },
    language,
  }).body;
  return {
    kind: 'sync',
    updates,
    override: collapse(override) === collapse(autoBody) ? null : override,
    annotations,
  };
}
