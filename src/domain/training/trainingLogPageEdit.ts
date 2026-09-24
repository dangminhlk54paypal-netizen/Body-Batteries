import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/types';
import { parseDecimal } from '../../lib/units';
import type { PageDay, PeriodPage } from './trainingLogPage';

// Reads the 📄 page back after the user edited it as plain text, and works out
// what changed compared with the page they started from: which day lines,
// day notes, week notes (and the block's title). Pure — the service decides
// what each change does to Xả / the notebook (trainingLogDaySync).
//
// The text is read with the same layout buildPeriodPage writes:
//   Block 2                       ← title (first line)
//   B2W1: 07.09–13.09 76.3kg      ← week heading
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

export interface PageEditDiff {
  days: DayEdit[];
  weekNotes: WeekNoteEdit[];
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

  const headingOf = (line: string) =>
    page.weeks.find(
      (w) =>
        collapse(line) === collapse(w.heading) ||
        line === w.label ||
        line.startsWith(`${w.label}:`) ||
        line.startsWith(`${w.label} `)
    );

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

    const week = headingOf(line);
    if (week) {
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

  const diff: PageEditDiff = { days: [], weekNotes: [], title: null, invalidDates };

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
  return diff;
}
