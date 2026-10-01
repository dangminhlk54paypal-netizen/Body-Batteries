import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/types';
import { activityLabel } from '../../lib/activityLabels';
import { LIFTING_EXERCISES } from '../../types/energy';
import type { LiftMaxRecord } from '../../types/trainingLog';
import type { LiftProgressWeek } from './trainingLogProgress';
import { dateCell, type SheetTable, type SheetValue } from '../export/sheetTable';

// The export's two training sheets — the same numbers the strength chart
// draws, so what the user sees and what they export agree. Pure: data in,
// SheetTable out (see domain/export/sheetTable.ts), headers in `language`.

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

// "Tiến độ sức mạnh": one row per week with a lift in it — the week's Monday
// and Sunday as real dates, its body weight, then per lift the heaviest
// working set, the estimated 1RM, and the ratio e1RM ÷ body weight (grouped
// by measure, so S / B / D sit side by side for each).
export function buildStrengthProgressSheet(weeks: LiftProgressWeek[], language: Language): SheetTable {
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
  const lift = (ex: (typeof LIFTING_EXERCISES)[number]) => ({ lift: activityLabel(ex, language) });
  const columns = [
    t('export.strength.weekStart'),
    t('export.strength.weekEnd'),
    t('export.strength.bodyWeight'),
    ...LIFTING_EXERCISES.map((ex) => t('export.strength.topKg', lift(ex))),
    ...LIFTING_EXERCISES.map((ex) => t('export.strength.e1rmKg', lift(ex))),
    ...LIFTING_EXERCISES.map((ex) => t('export.strength.ratio', lift(ex))),
  ];
  const rows = weeks.map((w): SheetValue[] => [
    dateCell(w.weekStart),
    dateCell(w.weekEnd),
    w.bodyWeightKg != null ? round(w.bodyWeightKg, 1) : null,
    ...LIFTING_EXERCISES.map((ex) => w.top[ex] ?? null),
    ...LIFTING_EXERCISES.map((ex) => w.e1rm[ex] ?? null),
    ...LIFTING_EXERCISES.map((ex) => {
      const e = w.e1rm[ex];
      return e != null && w.bodyWeightKg ? round(e / w.bodyWeightKg, 2) : null;
    }),
  ]);
  return { name: t('export.sheets.strengthProgress'), columns, rows };
}

// "1RM": every one-rep max the user recorded, oldest first.
export function buildLiftMaxSheet(
  maxes: LiftMaxRecord[],
  bodyWeightOf: (date: string) => number | null,
  language: Language
): SheetTable {
  const t = (key: string) => translate(language, key);
  const columns = [
    t('export.strength.date'),
    t('export.strength.lift'),
    t('export.strength.kg'),
    t('export.strength.bodyWeight'),
    t('export.strength.ratioOne'),
    t('export.strength.note'),
  ];
  const rows = [...maxes]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .map((m): SheetValue[] => {
      const bw = bodyWeightOf(m.date);
      return [
        dateCell(m.date),
        activityLabel(m.lift, language),
        m.weightKg,
        bw ? round(bw, 1) : null,
        bw ? round(m.weightKg / bw, 2) : null,
        m.note || null,
      ];
    });
  return { name: t('export.sheets.liftMaxes'), columns, rows };
}
