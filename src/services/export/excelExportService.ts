import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { utils } from 'xlsx';
import { headerCells, tableToSheet, workbookToBase64WithFrozenHeaders, wrapColumnCells } from './xlsxWriteUtils';
import { getReadingsInRange } from '../../data/repositories/batteryRepository';
import { getIntakeEventsInRange } from '../../data/repositories/intakeRepository';
import { getFoodLogInRange } from '../../data/repositories/foodLogRepository';
import { getAppleHealthBurnedInRange, getWeightsInRange } from '../../data/repositories/healthSignalsRepository';
import { getActivityLogInRange } from '../../data/repositories/activityLogRepository';
import { getTrainingLogDaysInRange } from '../../data/repositories/trainingLogRepository';
import { listLiftMaxes } from '../../data/repositories/liftMaxRepository';
import { bodyWeightOn, buildLiftProgress } from '../../domain/training/trainingLogProgress';
import { buildLiftMaxSheet, buildStrengthProgressSheet } from '../../domain/training/strengthExcelRows';
import {
  buildActivitySheet,
  buildBatterySheet,
  buildDailyNotesSheet,
  buildDailySheet,
  buildFoodSheet,
  buildPeriodAveragesSheet,
  buildQuickLogSheet,
  buildReadMeSheet,
  buildReferenceSheet,
  type DataWorkbookInput,
  type SheetGuideKey,
} from '../../domain/export/dataWorkbook';
import { EXCEL_DATE_FORMATS, type SheetTable } from '../../domain/export/sheetTable';
import { resolveTrainingLogFormat } from '../../types/trainingLog';
import { todayString, daysAgo, addDaysToDateString } from '../../lib/dateUtils';
import { useSettingsStore } from '../../store/settingsStore';
import { nutrientTargetsForProfile } from '../../lib/nutrientTargets';
import { getAnyFoodById } from '../../data/food/foodLookup';
import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/types';

// Build the .xlsx for an arbitrary date range and return it as base64. Does
// the DB reads but no file I/O — shared by every export. The sheets
// themselves are pure SheetTables (domain/export/dataWorkbook.ts,
// domain/training/strengthExcelRows.ts): one header row, one record per row,
// real dates, bare numbers with the unit in the header — so the file can be
// sorted, filtered and pivoted as-is. Every header/label follows `language`.
async function buildWorkbookBase64(fromDate: string, toDate: string, language: Language): Promise<string> {
  const [readings, intakeLog, foodLog, activityLog, appleHealthBurned, trainingDays, liftWeights, liftMaxes] =
    await Promise.all([
      getReadingsInRange(fromDate, toDate),
      getIntakeEventsInRange(fromDate, toDate),
      getFoodLogInRange(fromDate, toDate),
      getActivityLogInRange(fromDate, toDate),
      getAppleHealthBurnedInRange(fromDate, toDate),
      getTrainingLogDaysInRange(fromDate, toDate),
      // A year earlier too, so the first training weeks can carry a weigh-in forward.
      getWeightsInRange(addDaysToDateString(fromDate, -365), toDate),
      listLiftMaxes(),
    ]);

  // Domain layer stays pure: read profile/targets here, pass them in.
  const settings = useSettingsStore.getState();
  const profile = settings.userProfile;
  const input: DataWorkbookInput = {
    fromDate,
    toDate,
    exportedOn: todayString(),
    language,
    profile,
    targets: nutrientTargetsForProfile(profile),
    foodLog,
    activityLog,
    intakeLog,
    readings,
    weights: liftWeights,
    appleHealthBurned,
    lookup: getAnyFoodById,
  };

  const sheets: { key: SheetGuideKey; table: SheetTable }[] = [
    { key: 'daily', table: buildDailySheet(input) },
    { key: 'foods', table: buildFoodSheet(input) },
    { key: 'activity', table: buildActivitySheet(input) },
    { key: 'quickLogs', table: buildQuickLogSheet(input) },
    { key: 'periodAverages', table: buildPeriodAveragesSheet(input) },
    { key: 'dailyNotes', table: buildDailyNotesSheet(input) },
    { key: 'referenceThresholds', table: buildReferenceSheet(input) },
    { key: 'batteryReadings', table: buildBatterySheet(input) },
  ];

  // Training sheets — the same numbers as the strength chart (Xả sessions AND
  // the notebook's own lines). Only added when there is something to show.
  const strengthWeeks = buildLiftProgress({
    entries: activityLog,
    dayRecords: trainingDays,
    weights: liftWeights,
    fallbackBodyWeightKg: profile.weightKg,
    format: resolveTrainingLogFormat(settings.trainingLogFormat),
    language,
  });
  if (strengthWeeks.length > 0) {
    sheets.push({ key: 'strengthProgress', table: buildStrengthProgressSheet(strengthWeeks, language) });
  }
  const maxesInRange = liftMaxes.filter((m) => m.date >= fromDate && m.date <= toDate);
  if (maxesInRange.length > 0) {
    const bodyWeightOf = (date: string) => bodyWeightOn(date, liftWeights, profile.weightKg);
    sheets.push({ key: 'liftMaxes', table: buildLiftMaxSheet(maxesInRange, bodyWeightOf, language) });
  }

  const readMe = buildReadMeSheet(input, sheets);
  const tables = [readMe, ...sheets.map((s) => s.table)];
  const wb = utils.book_new();
  tables.forEach((table, i) => {
    // "Read me" is notes, not data: no filter buttons.
    const sheet = tableToSheet(table, EXCEL_DATE_FORMATS[language], { autoFilter: i > 0 });
    utils.book_append_sheet(wb, sheet, table.name);
  });
  // Bold header row on every sheet (frozen too — see workbookToBase64WithFrozenHeaders);
  // the long "Read me" texts wrap inside their column.
  return workbookToBase64WithFrozenHeaders(wb, [
    ...tables.flatMap((table, i) => headerCells(i + 1, table)),
    ...wrapColumnCells(1, readMe, 1),
  ]);
}

// Build + write the workbook for a date range into the app document directory
// (persistent, visible in Files). Returns the file URI and does NOT open the
// share sheet — used by the silent monthly auto-export.
export async function exportDataInRangeToFile(
  fromDate: string,
  toDate: string,
  filename: string,
  language: Language
): Promise<string> {
  const base64 = await buildWorkbookBase64(fromDate, toDate, language);
  const file = new File(Paths.document, filename);
  file.create({ overwrite: true });
  file.write(base64, { encoding: 'base64' });
  return file.uri;
}

// Build, write, and open the OS share sheet so the user can save/send the file.
export async function exportDataInRange(
  fromDate: string,
  toDate: string,
  filename: string,
  language: Language
): Promise<void> {
  const uri = await exportDataInRangeToFile(fromDate, toDate, filename, language);
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: translate(language, 'export.shareDialogTitle'),
    });
  }
}

// Last 7 days.
export async function exportWeeklyData(language: Language): Promise<void> {
  const toDate = todayString();
  const fromDate = daysAgo(7);
  const stamp = toDate.replace(/-/g, '');
  await exportDataInRange(fromDate, toDate, `${stamp}_BodyBatteries_Last_7_Days.xlsx`, language);
}

// Last 30 days — on-demand full-month export.
export async function exportMonthlyData(language: Language): Promise<void> {
  const toDate = todayString();
  const stamp = toDate.replace(/-/g, '');
  await exportDataInRange(daysAgo(30), toDate, `${stamp}_BodyBatteries_Last_30_Days.xlsx`, language);
}
