import { dateString } from '../../lib/dateUtils';
import type { Language } from '../../i18n/types';
import { translate } from '../../i18n/translate';
import type { ActivityLogEntry } from '../../types/energy';
import type {
  TrainingLogDayRecord,
  TrainingLogFormat,
  TrainingLogPeriod,
  TrainingLogWeekRecord,
} from '../../types/trainingLog';
import {
  formatDayLine,
  formatDefaultWeekLabel,
  formatPeriodTitle,
  formatWeekHeading,
  formatWeekLabel,
  formatWeekRange,
} from './trainingLogFormatter';
import { weekHeadingWeight } from './trainingLogWeights';
import type { WeightPoint } from './trainingLogWeights';

export interface PeriodPageInput {
  period: TrainingLogPeriod;
  entries: ActivityLogEntry[]; // Xả entries over the period's date range
  dayRecords: TrainingLogDayRecord[]; // the user's lines/notes over the range
  weekRecords: TrainingLogWeekRecord[];
  weights: WeightPoint[]; // manual weigh-ins over the range
  format: TrainingLogFormat;
  language: Language;
}

export interface PageDay {
  date: string;
  prefix: string; // "26.08(77.7kg):"
  body: string; // what the page shows after the prefix (the user's line or the auto one)
  note: string; // '' = none
  weightKg: number | null; // the weigh-in printed in the prefix
}

export interface PageWeek {
  weekStart: string;
  label: string; // "B2W1" / "07.09–13.09" / the user's own "B3W3"
  heading: string; // the whole heading line
  note: string;
  range: string; // "21.09–27.09" — how the page editor finds the heading
  defaultLabel: string; // the label without the user's ("B2W1"; '' in a free week)
  customLabel: string; // the user's label, '' = none
  weekEnd: string;
  weightKg: number | null; // the weight its heading prints (weekHeadingWeight), null = none
}

// The page as data: what every line of the text stands for. The page editor
// diffs the user's edited text against this.
export interface PeriodPage {
  title: string;
  weeks: PageWeek[];
  days: PageDay[];
  text: string;
  // Days whose line is hand-written (no Xả session behind it) — what
  // "Ghi dòng tay vào Xả" can turn into sessions.
  manualDates: string[];
}

// The whole period as ONE block of plain text, laid out exactly like the
// user's Apple Notes, so it can be shared and pasted straight back into Notes:
//
//   Block 2
//   B2W1: 26.07–01.08
//   26.07: D 100 5x5x80 PS 90 5x5x70
//   Cảm giác quá tải thần kinh
//
//   B2W2: 02.08–08.08 77.5kg
//   03.08: B 90 5x5x70 iC 5x5x60
//
// It is built from the same functions the on-screen notebook uses
// (formatDayLine, the user's overrides, week headings) — there is no second
// formatting path, so the shared text can never disagree with what is shown.
export function buildPeriodPage(input: PeriodPageInput): PeriodPage {
  const { period, entries, dayRecords, weekRecords, weights, format, language } = input;

  const entriesByDate = new Map<string, ActivityLogEntry[]>();
  for (const e of entries) {
    // Same day rule as the index and History: COALESCE(start_at, timestamp).
    const date = dateString(new Date(e.startAt ?? e.timestamp));
    entriesByDate.set(date, [...(entriesByDate.get(date) ?? []), e]);
  }
  const recordsByDate = new Map(dayRecords.map((r) => [r.date, r]));
  const notesByWeek = new Map(weekRecords.map((r) => [r.weekStart, r.note?.trim() ?? '']));

  const title = formatPeriodTitle(period, language);
  const lines: string[] = [title];
  const weeks: PageWeek[] = [];
  const days: PageDay[] = [];
  const manualDates: string[] = [];

  period.weeks.forEach((week, i) => {
    if (i > 0) lines.push('');
    const headingWeight = format.showBodyWeight ? weekHeadingWeight(week.weekStart, week.weekEnd, weights) : null;
    const heading = formatWeekHeading(week, headingWeight, format, language);
    lines.push(heading);

    let written = 0;
    const weekNote = notesByWeek.get(week.weekStart) ?? '';
    weeks.push({
      weekStart: week.weekStart,
      label: formatWeekLabel(week, language),
      heading,
      note: weekNote,
      range: formatWeekRange(week, language),
      defaultLabel: week.block ? formatDefaultWeekLabel(week, language) : '',
      customLabel: week.customLabel ?? '',
      weekEnd: week.weekEnd,
      weightKg: headingWeight,
    });
    if (weekNote) {
      lines.push(weekNote);
      written++;
    }

    for (const date of week.dates) {
      const record = recordsByDate.get(date);
      // Day lines carry no weight — the week heading already shows it. A
      // weigh-in typed into a day prefix is still read back (parsePageText).
      const weightKg = null;
      const { prefix, body: autoBody } = formatDayLine({
        date,
        entries: entriesByDate.get(date) ?? [],
        bodyWeightKg: weightKg,
        format,
        language,
      });
      const body = record?.overrideText ?? autoBody;
      const note = record?.note?.trim() ?? '';
      if (!body && !note) continue; // nothing to say for this day
      days.push({ date, prefix, body, note, weightKg });
      const hasXa = (entriesByDate.get(date) ?? []).some((e) => e.workouts.length > 0);
      if (!hasXa && record?.overrideText && record.overrideText.trim() !== '') manualDates.push(date);
      lines.push(body ? `${prefix} ${body}` : prefix);
      if (note) lines.push(note);
      written++;
    }

    if (written === 0) lines.push(translate(language, 'trainingLog.emptyWeek'));
  });

  return { title, weeks, days, text: lines.join('\n'), manualDates };
}

export function buildPeriodText(input: PeriodPageInput): string {
  return buildPeriodPage(input).text;
}
