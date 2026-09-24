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
import { formatDayLine, formatPeriodTitle, formatWeekHeading, formatWeekLabel } from './trainingLogFormatter';
import { firstWeightInRange, weightRecordedOn } from './trainingLogWeights';
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
  label: string; // "B2W1" / "07.09–13.09"
  heading: string; // the whole heading line
  note: string;
}

// The page as data: what every line of the text stands for. The page editor
// diffs the user's edited text against this.
export interface PeriodPage {
  title: string;
  weeks: PageWeek[];
  days: PageDay[];
  text: string;
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

  period.weeks.forEach((week, i) => {
    if (i > 0) lines.push('');
    const heading = formatWeekHeading(
      week,
      period,
      firstWeightInRange(week.weekStart, week.weekEnd, weights),
      format,
      language
    );
    lines.push(heading);

    let written = 0;
    const weekNote = notesByWeek.get(week.weekStart) ?? '';
    weeks.push({ weekStart: week.weekStart, label: formatWeekLabel(week, period, language), heading, note: weekNote });
    if (weekNote) {
      lines.push(weekNote);
      written++;
    }

    for (const date of week.dates) {
      const record = recordsByDate.get(date);
      const weightKg = format.showBodyWeight ? weightRecordedOn(date, weights) : null;
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
      lines.push(body ? `${prefix} ${body}` : prefix);
      if (note) lines.push(note);
      written++;
    }

    if (written === 0) lines.push(translate(language, 'trainingLog.emptyWeek'));
  });

  return { title, weeks, days, text: lines.join('\n') };
}

export function buildPeriodText(input: PeriodPageInput): string {
  return buildPeriodPage(input).text;
}
