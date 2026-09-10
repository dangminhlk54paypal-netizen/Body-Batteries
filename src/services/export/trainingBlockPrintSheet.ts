import { utils } from 'xlsx';
import type { StyledCell } from './xlsxWriteUtils';
import { weekdayLabel, formatDisplayDate } from '../../lib/dateUtils';
import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/types';
import type { GeneratedBlockPlan } from '../../types/powerliftingBlock';

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
// variationId.
export function buildPlanCrosstab(plan: GeneratedBlockPlan, language: Language): PlanCrosstab {
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

  aoa.push(pad([])); // spacer between title and week header

  aoa.push(
    pad([
      '',
      ...weeks.map((w) =>
        w.isDeload ? t('planAppendix.deloadBadge') : t('planAppendix.weekLabel', { number: w.weekNumber })
      ),
    ])
  );
  const headerRowIdx = aoa.length - 1;
  for (let c = 1; c < colCount; c++) {
    styledCells.push({ sheet: 1, ref: utils.encode_cell({ r: headerRowIdx, c }), tier: 2 });
  }

  // Week 1's day/variation structure is the canonical row order — every
  // other week resolves the same template, so [dayIdx][varIdx] lines up.
  const templateDays = weeks[0].days;
  templateDays.forEach((day, dayIdx) => {
    day.variations.forEach((templateVariation, varIdx) => {
      const label = t(`blockVariations.${templateVariation.variation.variationId}.label`);

      const plannedRow: (string | number)[] = [t('export.trainingBlock.plannedRowLabel', { label })];
      for (const week of weeks) {
        const weekVariation = week.days[dayIdx]?.variations[varIdx];
        const working = weekVariation?.sets[0];
        plannedRow.push(
          weekVariation && working
            ? t('export.trainingBlock.cellLine', {
                sets: weekVariation.sets.length,
                reps: working.reps,
                weight: working.weightKg,
                pct: weekVariation.pct1rm,
              })
            : ''
        );
      }
      aoa.push(pad(plannedRow));
      styledCells.push({ sheet: 1, ref: utils.encode_cell({ r: aoa.length - 1, c: 0 }), tier: 3 });

      aoa.push(pad([t('export.trainingBlock.actualRowLabel', { label })]));
      styledCells.push({ sheet: 1, ref: utils.encode_cell({ r: aoa.length - 1, c: 0 }), tier: 3 });

      aoa.push(pad([])); // spacer between lifts
    });
  });

  // Accessories don't fit the weekly crosstab (free-text, not %1RM-driven —
  // see AccessoryLineItem) — listed underneath instead of dropped, using
  // the week-1 resolved sets/reps (Deficit Mode's cut, if any, is uniform
  // across weeks, so week 1 already reflects the real numbers).
  if (templateDays.some((d) => d.accessories.length > 0)) {
    aoa.push(pad([t('planAppendix.accessoriesSectionTitle')]));
    styledCells.push({ sheet: 1, ref: utils.encode_cell({ r: aoa.length - 1, c: 0 }), tier: 3 });
    for (const day of templateDays) {
      if (day.accessories.length === 0) continue;
      const dayLabel = weekdayLabel(day.dayOfWeek, language, 'long');
      for (const acc of day.accessories) {
        aoa.push(
          pad([dayLabel, t('planAppendix.accessoryLine', { name: acc.customName, sets: acc.sets, reps: acc.reps })])
        );
      }
    }
  }

  return { aoa, styledCells, colCount };
}
