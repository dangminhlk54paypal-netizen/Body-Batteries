import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { utils } from 'xlsx';
import { autoFitColumns, workbookToBase64WithFrozenHeaders } from './xlsxWriteUtils';
import { buildPlanCrosstab } from './trainingBlockPrintSheet';
import { formatDisplayDate } from '../../lib/dateUtils';
import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/types';
import type { GeneratedBlockPlan } from '../../types/powerliftingBlock';

// Excel export for the S-PL Block Builder's Plan Appendix — lets the user
// print/reference the plan outside the app. Sheet 1 ("Kế hoạch Block") is
// the crosstab built by buildPlanCrosstab() (see trainingBlockPrintSheet.ts
// for the layout rationale). Sheet 2 ("Tổng theo tuần") is a plain per-week
// kcal/deficit-target summary.
export async function exportTrainingBlockToExcelFile(
  plan: GeneratedBlockPlan,
  language: Language
): Promise<string> {
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
  const { weeks } = plan;

  const { aoa, styledCells, colCount } = buildPlanCrosstab(plan, language);
  const planSheet = utils.aoa_to_sheet(aoa);
  planSheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }];
  planSheet['!cols'] = [{ wch: 34 }, ...weeks.map(() => ({ wch: 26 }))];

  const weekRows = weeks.map((w) => ({
    [t('export.trainingBlock.week')]: w.isDeload ? `${w.weekNumber} (${t('planAppendix.deloadBadge')})` : w.weekNumber,
    [t('export.trainingBlock.dateRange')]: `${formatDisplayDate(w.startDate, language)} - ${formatDisplayDate(w.endDate, language)}`,
    [t('export.trainingBlock.kcal')]: w.totalKcal,
    [t('export.trainingBlock.deficitTarget')]: w.weeklyDeficitTargetKcal ?? '',
  }));
  const weekSheet = utils.json_to_sheet(weekRows);
  autoFitColumns(weekSheet);

  const wb = utils.book_new();
  utils.book_append_sheet(wb, planSheet, t('export.trainingBlock.sheetPlan'));
  utils.book_append_sheet(wb, weekSheet, t('export.trainingBlock.sheetWeekly'));

  const base64 = workbookToBase64WithFrozenHeaders(wb, styledCells);
  const stamp = plan.config.weekStartDate.replace(/-/g, '');
  const file = new File(Paths.document, `${stamp}_BodyBatteries_PowerliftingBlock.xlsx`);
  file.create({ overwrite: true });
  file.write(base64, { encoding: 'base64' });
  return file.uri;
}

export async function exportTrainingBlockToExcel(plan: GeneratedBlockPlan, language: Language): Promise<void> {
  const uri = await exportTrainingBlockToExcelFile(plan, language);
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: translate(language, 'export.shareDialogTitle'),
    });
  }
}
