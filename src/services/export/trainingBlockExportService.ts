import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { utils } from 'xlsx';
import { autoFitColumns, workbookToBase64WithFrozenHeaders } from './excelExportService';
import { weekdayLabel, formatDisplayDate } from '../../lib/dateUtils';
import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/types';
import type { GeneratedBlockPlan } from '../../types/powerliftingBlock';

// Excel export for the S-PL Block Builder's Plan Appendix — lets the user
// print/reference the plan outside the app. Reuses the shared xlsx helpers
// from excelExportService.ts (autoFitColumns, frozen header row) rather than
// a second implementation.
export async function exportTrainingBlockToExcelFile(
  plan: GeneratedBlockPlan,
  language: Language
): Promise<string> {
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);

  const planRows: Record<string, string | number>[] = [];
  for (const week of plan.weeks) {
    const weekLabel = week.isDeload
      ? `${week.weekNumber} (${t('planAppendix.deloadBadge')})`
      : String(week.weekNumber);
    const dateRange = `${formatDisplayDate(week.startDate, language)} - ${formatDisplayDate(week.endDate, language)}`;
    for (const day of week.days) {
      const dayLabel = weekdayLabel(day.dayOfWeek, language, 'long');
      for (const v of day.variations) {
        const working = v.sets[0];
        planRows.push({
          [t('export.trainingBlock.week')]: weekLabel,
          [t('export.trainingBlock.dateRange')]: dateRange,
          [t('export.trainingBlock.day')]: dayLabel,
          [t('export.trainingBlock.exercise')]: t(`blockVariations.${v.variation.variationId}.label`),
          [t('export.trainingBlock.role')]:
            v.variation.role === 'main' ? t('blockBuilder.scheduleRoleMain') : t('blockBuilder.scheduleRoleSecondary'),
          [t('export.trainingBlock.pct1rm')]: v.pct1rm,
          [t('export.trainingBlock.sets')]: v.sets.length,
          [t('export.trainingBlock.reps')]: working?.reps ?? '',
          [t('export.trainingBlock.weightKg')]: working?.weightKg ?? '',
          [t('export.trainingBlock.kcal')]: v.estimatedKcal,
        });
      }
      for (const acc of day.accessories) {
        planRows.push({
          [t('export.trainingBlock.week')]: weekLabel,
          [t('export.trainingBlock.dateRange')]: dateRange,
          [t('export.trainingBlock.day')]: dayLabel,
          [t('export.trainingBlock.exercise')]: acc.customName,
          [t('export.trainingBlock.role')]: t('planAppendix.accessoriesSectionTitle'),
          [t('export.trainingBlock.pct1rm')]: '',
          [t('export.trainingBlock.sets')]: acc.sets,
          [t('export.trainingBlock.reps')]: acc.reps,
          [t('export.trainingBlock.weightKg')]: '',
          [t('export.trainingBlock.kcal')]: '',
        });
      }
    }
  }

  const weekRows = plan.weeks.map((w) => ({
    [t('export.trainingBlock.week')]: w.isDeload ? `${w.weekNumber} (${t('planAppendix.deloadBadge')})` : w.weekNumber,
    [t('export.trainingBlock.dateRange')]: `${formatDisplayDate(w.startDate, language)} - ${formatDisplayDate(w.endDate, language)}`,
    [t('export.trainingBlock.kcal')]: w.totalKcal,
    [t('export.trainingBlock.deficitTarget')]: w.weeklyDeficitTargetKcal ?? '',
  }));

  const wb = utils.book_new();

  const planSheet = utils.json_to_sheet(planRows);
  autoFitColumns(planSheet);
  utils.book_append_sheet(wb, planSheet, t('export.trainingBlock.sheetPlan'));

  const weekSheet = utils.json_to_sheet(weekRows);
  autoFitColumns(weekSheet);
  utils.book_append_sheet(wb, weekSheet, t('export.trainingBlock.sheetWeekly'));

  const base64 = workbookToBase64WithFrozenHeaders(wb);
  const stamp = plan.config.weekStartDate.replace(/-/g, '');
  const uri = FileSystem.documentDirectory + `${stamp}_BodyBatteries_PowerliftingBlock.xlsx`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
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
