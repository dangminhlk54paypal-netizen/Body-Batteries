import { utils } from 'xlsx';
import type { StyledCell } from './xlsxWriteUtils';
import { weekdayLabel, formatDisplayDate } from '../../lib/dateUtils';
import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/types';
import type { GeneratedBlockPlan } from '../../types/powerliftingBlock';
import { formatSetSequence } from '../../domain/training/trainingLogFormatter';
import { DEFAULT_TRAINING_LOG_FORMAT } from '../../types/trainingLog';
import { blockTrainingMax } from '../../domain/energy/blockForm';
import type { LiftingExercise } from '../../types/energy';
import { LOCALE_TAGS } from '../../i18n/types';

export interface PlanCrosstab {
  aoa: (string | number)[][];
  styledCells: StyledCell[];
  colCount: number;
}

// Builds the "Kế hoạch Block" print sheet as an array-of-arrays: a crosstab
// — one row PAIR per main lift (Planned + a blank hand-written Actual row
// underneath), one column per week — modeled on a real printed powerlifting
// block sheet the user supplied as a reference; the exact content differs
// (this app's rep scheme, not a top-single-then-backoff style) but the
// printed shape matches. `styledCells` marks which cells the caller should
// bold/enlarge (see excelExportService.workbookToBase64WithFrozenHeaders) —
// this function stays a pure data transform, no xlsx-writing/file I/O, so it
// can be unit tested directly. `config.schedule` is identical across every
// week (blockEngine.ts resolves each week from the same template), so
// day/variation index pairs line up 1:1 week to week — no need to match by
// variationId. `nickname` ('' = not set) goes in row 2 under the title, so a
// printed sheet says whose plan it is.
export function buildPlanCrosstab(plan: GeneratedBlockPlan, language: Language, nickname = ''): PlanCrosstab {
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
  const { weeks, config } = plan;
  const colCount = 1 + weeks.length;
  const pad = (row: (string | number)[]) => [...row, ...Array(Math.max(0, colCount - row.length)).fill('')];

  const focusLabelKey = `focus${config.focus.charAt(0).toUpperCase()}${config.focus.slice(1)}Label`;
  const title = t('export.trainingBlock.printTitle', {
    focus: t(`blockBuilder.${focusLabelKey}`),
    start: formatDisplayDate(weeks[0].startDate, language),
    end: formatDisplayDate(weeks[weeks.length - 1].endDate, language),
  });

  const aoa: (string | number)[][] = [];
  const styledCells: StyledCell[] = [];

  aoa.push(pad([title]));
  styledCells.push({ sheet: 1, ref: 'A1', tier: 1 });

  // Whose plan (or an empty spacer) between title and week header.
  aoa.push(pad(nickname ? [t('export.trainingBlock.athlete', { name: nickname })] : []));

  aoa.push(
    pad([
      '',
      ...weeks.map((w) => {
        const label = w.isDeload ? t('planAppendix.deloadBadge') : t('planAppendix.weekLabel', { number: w.weekNumber });
        return w.skipped ? `${label} (${t('export.trainingBlock.offCell')})` : label;
      }),
    ])
  );
  const headerRowIdx = aoa.length - 1;
  for (let c = 1; c < colCount; c++) {
    styledCells.push({ sheet: 1, ref: utils.encode_cell({ r: headerRowIdx, c }), tier: 2 });
  }

  // Week 1's day/variation structure is the canonical row order — every
  // other week resolves the same template, so [dayIdx][varIdx] lines up.
  const templateDays = weeks[0].days;
  // "Planned Comp Bench (TM = 117,5)": the block's Training Max for the lift
  // (linear blocks), else the max its loads are taken of (1RM × load factor).
  const tmOf = (variationId: string, exercise: LiftingExercise) =>
    blockTrainingMax(plan, variationId, exercise).toLocaleString(LOCALE_TAGS[language]);
  templateDays.forEach((day, dayIdx) => {
    day.variations.forEach((templateVariation, varIdx) => {
      const label = t(`blockVariations.${templateVariation.variation.variationId}.label`);

      const tm = tmOf(templateVariation.variation.variationId, templateVariation.variation.exercise);
      const plannedRow: (string | number)[] = [t('export.trainingBlock.plannedRowLabel', { label, tm })];
      for (const week of weeks) {
        // A week or day the user took off prints as such, not as training.
        if (week.skipped || week.days[dayIdx]?.skipped) {
          plannedRow.push(t('export.trainingBlock.offCell'));
          continue;
        }
        const weekVariation = week.days[dayIdx]?.variations[varIdx];
        // The plan in the user's own notation ("110 5x5x95") — it can be
        // uneven once they edited it (a top single + back-offs), so print every
        // set rather than "sets × reps of the first set".
        plannedRow.push(
          weekVariation && weekVariation.sets.length > 0
            ? t('export.trainingBlock.cellLine', {
                sets: formatSetSequence(weekVariation.sets, DEFAULT_TRAINING_LOG_FORMAT, language),
                pct: weekVariation.pct1rm,
              })
            : ''
        );
      }
      aoa.push(pad(plannedRow));
      styledCells.push({ sheet: 1, ref: utils.encode_cell({ r: aoa.length - 1, c: 0 }), tier: 3 });

      // "Actual": blank to write in by hand, or the RPE the lifter rated in the app.
      const actualRow: (string | number)[] = [t('export.trainingBlock.actualRowLabel', { label })];
      for (const week of weeks) {
        const rpe = week.days[dayIdx]?.variations[varIdx]?.actualRpe;
        actualRow.push(rpe != null ? `RPE ${rpe.toLocaleString(LOCALE_TAGS[language])}` : '');
      }
      aoa.push(pad(actualRow));
      styledCells.push({ sheet: 1, ref: utils.encode_cell({ r: aoa.length - 1, c: 0 }), tier: 3 });

      aoa.push(pad([])); // spacer between lifts
    });
  });

  // Accessories are free text (not %1RM-driven — see AccessoryLineItem), listed
  // underneath the lifts: one row per exercise of a day, one cell per week,
  // since the user can add or change them for single weeks in the plan.
  if (weeks.some((w) => w.days.some((d) => d.accessories.length > 0))) {
    aoa.push(pad([t('planAppendix.accessoriesSectionTitle')]));
    styledCells.push({ sheet: 1, ref: utils.encode_cell({ r: aoa.length - 1, c: 0 }), tier: 3 });
    templateDays.forEach((day, dayIdx) => {
      const names: string[] = [];
      for (const week of weeks) {
        for (const acc of week.days[dayIdx]?.accessories ?? []) if (!names.includes(acc.customName)) names.push(acc.customName);
      }
      const dayLabel = weekdayLabel(day.dayOfWeek, language, 'long');
      for (const name of names) {
        const row: (string | number)[] = [dayLabel];
        for (const week of weeks) {
          const weekDay = week.days[dayIdx];
          const acc = weekDay?.accessories.find((a) => a.customName === name);
          if (week.skipped || weekDay?.skipped) row.push(acc ? t('export.trainingBlock.offCell') : '');
          else row.push(acc ? t('planAppendix.accessoryLine', { name: acc.customName, sets: acc.sets, reps: acc.reps }) : '');
        }
        aoa.push(pad(row));
      }
    });
  }

  // Weeks off the user put INTO the block ("Dời các tuần sau") — the weeks
  // after them already carry their moved dates; this says where the gaps are.
  const breaks = config.breaks ?? [];
  if (breaks.length > 0) {
    aoa.push(pad([]));
    aoa.push(pad([t('export.trainingBlock.breaksTitle')]));
    styledCells.push({ sheet: 1, ref: utils.encode_cell({ r: aoa.length - 1, c: 0 }), tier: 3 });
    for (const brk of breaks) {
      aoa.push(pad([`${formatDisplayDate(brk.startDate, language)} - ${formatDisplayDate(brk.endDate, language)}`]));
    }
  }

  return { aoa, styledCells, colCount };
}
