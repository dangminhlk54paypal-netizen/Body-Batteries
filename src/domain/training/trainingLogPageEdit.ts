import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/types';
import { parseDecimal } from '../../lib/units';
import type { PageDay, PageWeek, PeriodPage } from './trainingLogPage';

// Reads the 📄 page back after the user edited it as plain text, and works out
// what changed compared with the page they started from: which day lines,
// day notes, week notes (and the block's title). Pure — the service decides
// what each change does to Xả / the notebook (trainingLogDaySync).
//
// The text is read with the same layout buildPeriodPage writes:
//   Block 2                       ← title (first line)
//   B2W1: 07.09–13.09 76.3kg      ← week heading ("B3W3: …" = the user's own label;
//                                   a changed weight = that week's weigh-in)
//   ngủ ít                        ← week note (lines before the first day)
//   08.09(76.3kg): S 130 4x3x115  ← day line
//   Cảm giác nặng                 ← day note (lines under a day)

export interface EditedDay {
  date: string;
  body: string;
  note: string;
  weightKg: number | null;
}

export interface DayEdit {
  date: string;
  before: PageDay | null; // null = a day the page did not have
  after: EditedDay | null; // null = the user deleted the line
}

export interface WeekNoteEdit {
  weekStart: string;
  label: string;
  before: string;
  after: string;
}

// The user typed their own name in front of a week's dates ("B3W3: 21.09–27.09"),
// or removed it. '' = no label (the default heading).
export interface WeekLabelEdit {
  weekStart: string;
  range: string;
  before: string;
  after: string;
}

// The weight in a week heading typed differently from what the page printed
// ("07.09–13.09 76.3kg" → "… 80kg"). Removing it is not an edit: the heading
// may only have carried an earlier week's weight forward.
export interface WeekWeightEdit {
  weekStart: string;
  weekEnd: string;
  label: string;
  before: number | null;
  after: number;
}

export interface PageEditDiff {
  days: DayEdit[];
  weekNotes: WeekNoteEdit[];
  weekLabels: WeekLabelEdit[];
  weekWeights: WeekWeightEdit[];
  title: { before: string; after: string } | null;
  invalidDates: string[]; // day-looking lines whose date is in the future / impossible
}

function collapse(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function sameNote(a: string, b: string): boolean {
  return a.split('\n').map(collapse).filter(Boolean).join('\n') === b.split('\n').map(collapse).filter(Boolean).join('\n');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function validDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

// dd.mm has no year: take the year that puts the date closest to the period.
function resolveYear(d: number, m: number, rangeStart: string, rangeEnd: string): string | null {
  const y0 = Number(rangeStart.slice(0, 4));
  const y1 = Number(rangeEnd.slice(0, 4));
  let best: string | null = null;
  let bestDist = Infinity;
  for (let y = y0 - 1; y <= y1 + 1; y++) {
    const date = validDate(y, m, d);
    if (!date) continue;
    const dist =
      date < rangeStart
        ? new Date(rangeStart).getTime() - new Date(date).getTime()
        : date > rangeEnd
          ? new Date(date).getTime() - new Date(rangeEnd).getTime()
          : 0;
    if (dist < bestDist) {
      best = date;
      bestDist = dist;
    }
  }
  return best;
}

// Optional weekday ("Th 2", "Mon"), dd.mm (or mm/dd in English, per the locale's
// dayDate), an optional "(77.7kg)", then ":" and the body.
const DAY_LINE = /^(?:[^\d\s(]\S*(?:\s+\d)?\s+)?(\d{1,2})[./-](\d{1,2})\.?\s*(?:\(\s*([\d.,]+)\s*[^\d\s)]*\s*\))?\s*:\s*(.*)$/;

// A week's heading line, found by its dates: an optional label ("B3W3:"), the
// week's range (any dash), and an optional weigh-in ("75kg"). Matching on the
// dates — not on the whole old heading — is what lets the user rename a week
// by typing in front of them.
function weekHeadingPattern(range: string): RegExp {
  const escaped = range
    .split('–')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))
    .join('\\s*[-–—]\\s*');
  return new RegExp(`^(?:(.*?)\\s*:?\\s*)?${escaped}(?:\\s+([\\d.,]+)\\s*[A-Za-z]*)?$`);
}

function sameLabel(a: string, b: string): boolean {
  return collapse(a).toLowerCase() === collapse(b).toLowerCase();
}

export function parsePageText(input: {
  page: PeriodPage;
  text: string;
  rangeStart: string;
  rangeEnd: string;
  today: string;
  language: Language;
}): PageEditDiff {
  const { page, text, rangeStart, rangeEnd, today, language } = input;
  const template = translate(language, 'trainingLog.format.dayDate');
  const monthFirst = template.indexOf('{{mm}}') < template.indexOf('{{dd}}');
  const emptyWeek = translate(language, 'trainingLog.emptyWeek');

  const days = new Map<string, EditedDay & { noteLines: string[] }>();
  const weekNotes = new Map<string, string[]>();
  const invalidDates: string[] = [];
  let title: string | null = null;
  let currentDay: string | null = null;
  let currentWeek: string | null = null;
  let seenContent = false;

  const weekLabels = new Map<string, string>();
  const weekWeights = new Map<string, number>();
  const patterns = page.weeks.map((w) => ({ week: w, re: weekHeadingPattern(w.range) }));

  // → the week plus the label typed in front of its dates ('' = none), or
  // label undefined when the line is only the old label ("B2W1").
  const headingOf = (line: string): { week: PageWeek; label?: string; weightKg?: number } | undefined => {
    for (const { week, re } of patterns) {
      const m = line.match(re);
      if (!m) continue;
      const typed = collapse((m[1] ?? '').replace(/:\s*$/, ''));
      const label = typed === '' || sameLabel(typed, week.defaultLabel) ? '' : typed;
      const weightKg = m[2] ? parseDecimal(m[2]) : NaN;
      return { week, label, ...(Number.isFinite(weightKg) ? { weightKg } : {}) };
    }
    const week = page.weeks.find(
      (w) =>
        collapse(line) === collapse(w.heading) ||
        line === w.label ||
        line.startsWith(`${w.label}:`) ||
        line.startsWith(`${w.label} `)
    );
    return week ? { week } : undefined;
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line === '') continue;

    const m = line.match(DAY_LINE);
    if (m) {
      const [a, b] = [Number(m[1]), Number(m[2])];
      const [d, mo] = monthFirst ? [b, a] : [a, b];
      const date = resolveYear(d, mo, rangeStart, rangeEnd);
      seenContent = true;
      if (!date || date > today) {
        invalidDates.push(line);
        currentDay = null;
        continue;
      }
      const weightKg = m[3] ? parseDecimal(m[3]) : null;
      const existing = days.get(date);
      if (existing) {
        existing.body = collapse(`${existing.body} ${m[4]}`);
      } else {
        days.set(date, {
          date,
          body: collapse(m[4]),
          note: '',
          noteLines: [],
          weightKg: weightKg != null && !isNaN(weightKg) ? weightKg : null,
        });
      }
      currentDay = date;
      continue;
    }

    const heading = headingOf(line);
    if (heading) {
      const { week, label, weightKg } = heading;
      // The same week's heading twice (e.g. a "B3W3: …" line left over as a
      // note above the real heading): the first label typed wins.
      if (label !== undefined && !weekLabels.get(week.weekStart)) weekLabels.set(week.weekStart, label);
      if (weightKg !== undefined && !weekWeights.has(week.weekStart)) weekWeights.set(week.weekStart, weightKg);
      seenContent = true;
      currentWeek = week.weekStart;
      currentDay = null;
      if (!weekNotes.has(week.weekStart)) weekNotes.set(week.weekStart, []);
      continue;
    }

    if (!seenContent && title == null) {
      title = line;
      continue;
    }
    if (line === emptyWeek) continue;
    if (currentDay) days.get(currentDay)!.noteLines.push(line);
    else if (currentWeek) weekNotes.get(currentWeek)!.push(line);
  }

  const diff: PageEditDiff = { days: [], weekNotes: [], weekLabels: [], weekWeights: [], title: null, invalidDates };

  if (title != null && collapse(title) !== collapse(page.title)) {
    diff.title = { before: page.title, after: collapse(title) };
  }

  const before = new Map(page.days.map((d) => [d.date, d]));
  const dates = [...new Set([...before.keys(), ...days.keys()])].sort();
  for (const date of dates) {
    const b = before.get(date) ?? null;
    const edited = days.get(date);
    const a: EditedDay | null = edited
      ? { date, body: edited.body, note: edited.noteLines.join('\n'), weightKg: edited.weightKg }
      : null;
    if (!a) {
      diff.days.push({ date, before: b, after: null });
      continue;
    }
    const changed =
      !b ||
      collapse(a.body) !== collapse(b.body) ||
      !sameNote(a.note, b.note) ||
      (a.weightKg ?? null) !== (b.weightKg ?? null);
    if (changed) diff.days.push({ date, before: b, after: a });
  }

  // A week whose heading the user deleted is left alone (its note lines would
  // have landed under the previous day or week — ambiguous).
  for (const w of page.weeks) {
    const lines = weekNotes.get(w.weekStart);
    if (!lines) continue;
    const after = lines.join('\n');
    if (!sameNote(after, w.note)) diff.weekNotes.push({ weekStart: w.weekStart, label: w.label, before: w.note, after });
  }
  for (const w of page.weeks) {
    const after = weekLabels.get(w.weekStart);
    if (after === undefined || collapse(after) === collapse(w.customLabel)) continue;
    diff.weekLabels.push({ weekStart: w.weekStart, range: w.range, before: w.customLabel, after });
  }
  for (const w of page.weeks) {
    const after = weekWeights.get(w.weekStart);
    // Compared at the precision the page prints (formatNumber: ≤ 2 decimals).
    if (after === undefined || (w.weightKg != null && Math.round(after * 100) === Math.round(w.weightKg * 100))) continue;
    diff.weekWeights.push({ weekStart: w.weekStart, weekEnd: w.weekEnd, label: w.label, before: w.weightKg, after });
  }
  return diff;
}
