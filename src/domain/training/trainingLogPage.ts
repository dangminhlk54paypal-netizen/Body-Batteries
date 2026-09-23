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
import { formatDayLine, formatPeriodTitle, formatWeekHeading } from './trainingLogFormatter';
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

// The whole period as ONE block of plain text, laid out exactly like the
// user's Apple Notes, so it can be shared and pasted straight back into Notes:
//
//   Block 2
//   W1:
//   26.07: D 100 5x5x80 PS 90 5x5x70
//   Cảm giác quá tải thần kinh
//
//   W2: 77.5kg
//   03.08: B 90 5x5x70 iC 5x5x60
//
// It is built from the same functions the on-screen notebook uses
// (formatDayLine, the user's overrides, week headings) — there is no second
// formatting path, so the shared text can never disagree with what is shown.
export function buildPeriodText(input: PeriodPageInput): string {
  const { period, entries, dayRecords, weekRecords, weights, format, language } = input;

  const entriesByDate = new Map<string, ActivityLogEntry[]>();
  for (const e of entries) {
    // Same day rule as the index and History: COALESCE(start_at, timestamp).
    const date = dateString(new Date(e.startAt ?? e.timestamp));
    entriesByDate.set(date, [...(entriesByDate.get(date) ?? []), e]);
  }
  const recordsByDate = new Map(dayRecords.map((r) => [r.date, r]));
  const notesByWeek = new Map(weekRecords.map((r) => [r.weekStart, r.note?.trim() ?? '']));

  const lines: string[] = [formatPeriodTitle(period, language)];

  period.weeks.forEach((week, i) => {
    if (i > 0) lines.push('');
    lines.push(
      formatWeekHeading(week, period.kind, firstWeightInRange(week.weekStart, week.weekEnd, weights), format, language)
    );

    let written = 0;
    const weekNote = notesByWeek.get(week.weekStart);
    if (weekNote) {
      lines.push(weekNote);
      written++;
    }

    for (const date of week.dates) {
      const record = recordsByDate.get(date);
      const { prefix, body: autoBody } = formatDayLine({
        date,
        entries: entriesByDate.get(date) ?? [],
        bodyWeightKg: format.showBodyWeight ? weightRecordedOn(date, weights) : null,
        format,
        language,
      });
      const body = record?.overrideText ?? autoBody;
      const note = record?.note?.trim() ?? '';
      if (!body && !note) continue; // nothing to say for this day
      lines.push(body ? `${prefix} ${body}` : prefix);
      if (note) lines.push(note);
      written++;
    }

    if (written === 0) lines.push(translate(language, 'trainingLog.emptyWeek'));
  });

  return lines.join('\n');
}
