import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/types';
import { activityLabel } from '../../lib/activityLabels';
import { formatDisplayDate } from '../../lib/dateUtils';
import { LIFTING_EXERCISES } from '../../types/energy';
import type { LiftMaxRecord } from '../../types/trainingLog';
import type { LiftProgressWeek } from './trainingLogProgress';

// Rows for the Excel export's two training sheets — the same numbers the
// strength chart draws, so what the user sees and what they export agree.
// Pure: data in, header-keyed rows out (json_to_sheet), headers in `language`.

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

// "Tiến độ sức mạnh": one row per week with a lift in it — the heaviest
// working set of S / B / D (Xả sessions + the user's own lines), that week's
// body weight, and each lift as a multiple of it.
export function buildStrengthProgressRows(
  weeks: LiftProgressWeek[],
  language: Language
): Record<string, string | number>[] {
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
  return weeks.map((w) => {
    const row: Record<string, string | number> = {
      [t('export.strength.week')]: `${formatDisplayDate(w.weekStart, language)} – ${formatDisplayDate(w.weekEnd, language)}`,
      [t('export.strength.bodyWeight')]: w.bodyWeightKg != null ? round(w.bodyWeightKg, 1) : '',
    };
    for (const lift of LIFTING_EXERCISES) {
      row[t('export.strength.topKg', { lift: activityLabel(lift, language) })] = w.top[lift] ?? '';
    }
    for (const lift of LIFTING_EXERCISES) {
      const kg = w.top[lift];
      row[t('export.strength.ratio', { lift: activityLabel(lift, language) })] =
        kg != null && w.bodyWeightKg ? round(kg / w.bodyWeightKg, 2) : '';
    }
    return row;
  });
}

// "1RM": every one-rep max the user recorded, oldest first.
export function buildLiftMaxRows(
  maxes: LiftMaxRecord[],
  bodyWeightOf: (date: string) => number | null,
  language: Language
): Record<string, string | number>[] {
  const t = (key: string) => translate(language, key);
  return [...maxes]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .map((m) => {
      const bw = bodyWeightOf(m.date);
      return {
        [t('export.strength.date')]: formatDisplayDate(m.date, language),
        [t('export.strength.lift')]: activityLabel(m.lift, language),
        [t('export.strength.kg')]: m.weightKg,
        [t('export.strength.ratioOne')]: bw ? round(m.weightKg / bw, 2) : '',
        [t('export.strength.note')]: m.note ?? '',
      };
    });
}
