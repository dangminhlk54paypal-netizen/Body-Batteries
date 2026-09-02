// Expo SDK 54 moved the classic file API behind `/legacy`. The main entry now
// exports the new File/Directory API, where `documentDirectory` /
// `writeAsStringAsync` / `EncodingType` are missing or throw at runtime.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { utils, write } from 'xlsx';
import type { WorkSheet } from 'xlsx';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { getReadingsInRange } from '../../data/repositories/batteryRepository';
import { getIntakeEventsInRange } from '../../data/repositories/intakeRepository';
import { getFoodLogInRange } from '../../data/repositories/foodLogRepository';
import { getWeightHistory } from '../../data/repositories/healthSignalsRepository';
import { getActivityLogInRange } from '../../data/repositories/activityLogRepository';
import { todayString, daysAgo, formatDisplayDate } from '../../lib/dateUtils';
import { mealLabel, batteryTypeName } from '../../lib/constants';
import { useSettingsStore } from '../../store/settingsStore';
import { nutrientTargetsForProfile } from '../../lib/nutrientTargets';
import { getAnyFoodById, foodLogEntryDisplayName } from '../../data/food/foodLookup';
import { summarizeWeeklyNutrition } from '../../domain/nutrition/dailyNutritionSummary';
import { buildDailyTotals, buildFoodEntryRows } from '../../domain/nutrition/excelSheets';
import { ASSESSMENT_RULES, ASSESSMENT_ORDER } from '../../domain/nutrition/nutritionAssessment';
import { translate } from '../../i18n/translate';
import { LOCALE_TAGS } from '../../i18n/types';
import type { Language } from '../../i18n/types';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// The free `xlsx` package always writes an empty `<sheetView/>` and has no
// public API for freeze panes (that's a paid-tier feature upstream). So we
// patch the raw sheet XML inside the already-built .xlsx zip: turn the empty
// self-closing tag into one that freezes row 1, on every worksheet.
function freezeHeaderRow(sheetXml: string): string {
  return sheetXml.replace(
    /<sheetView([^/>]*)\/>/,
    '<sheetView$1><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
      '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>'
  );
}

// Excel's `wch` column-width unit is roughly chars-in-Calibri-11: pixel
// width ≈ wch * 7 + 5, and at 96dpi 12cm ≈ 454px, so 12cm caps out around
// (454 - 5) / 7 ≈ 64.1 → 64 chars. MIN keeps narrow columns (e.g. "STT")
// from collapsing to unreadable widths.
const AUTO_FIT_MAX_WCH = 64;
const AUTO_FIT_MIN_WCH = 8;
const AUTO_FIT_PADDING = 2;

// Auto-fit every column of a worksheet to its actual content (header +
// all cell values), capped at ~6cm (see AUTO_FIT_MAX_WCH above) so long
// text (food names, advice strings, source URLs) wraps/truncates instead
// of blowing the sheet out to full-page width.
function autoFitColumns(sheet: WorkSheet): void {
  const ref = sheet['!ref'];
  if (!ref) return;
  const range = utils.decode_range(ref);
  const widths: { wch: number }[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    let maxLen = AUTO_FIT_MIN_WCH;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cell = sheet[utils.encode_cell({ r, c })];
      if (cell == null || cell.v == null) continue;
      maxLen = Math.max(maxLen, String(cell.v).length);
    }
    widths.push({ wch: Math.min(maxLen + AUTO_FIT_PADDING, AUTO_FIT_MAX_WCH) });
  }
  sheet['!cols'] = widths;
}

// btoa() needs a Latin1 "binary string" (one char per byte); chunk the
// conversion so String.fromCharCode's arg spread never blows the call stack
// on multi-hundred-KB workbooks.
function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// Freeze the header row on every sheet by unzipping the .xlsx, patching each
// xl/worksheets/sheetN.xml, and re-zipping — see freezeHeaderRow() above.
function workbookToBase64WithFrozenHeaders(wb: ReturnType<typeof utils.book_new>): string {
  const zipBytes = new Uint8Array(write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
  const entries = unzipSync(zipBytes);
  for (const path of Object.keys(entries)) {
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(path)) {
      entries[path] = strToU8(freezeHeaderRow(strFromU8(entries[path])));
    }
  }
  return uint8ToBase64(zipSync(entries));
}

// Build the .xlsx (all 8 sheets) for an arbitrary date range and return it as a
// base64 string. Does the DB reads but no file I/O — shared by every export.
// Every header/label in the workbook follows `language` — see
// src/i18n/locales/*.ts `export.*`/`nutrients.*`/`meals.*`/`batteries.*`.
async function buildWorkbookBase64(fromDate: string, toDate: string, language: Language): Promise<string> {
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
  const localeTag = LOCALE_TAGS[language];

  const readings = await getReadingsInRange(fromDate, toDate);
  const intakes = await getIntakeEventsInRange(fromDate, toDate);
  const foodLog = await getFoodLogInRange(fromDate, toDate);
  const weights = await getWeightHistory(1000);
  const activityLog = await getActivityLogInRange(fromDate, toDate);
  const energyReadings = readings.filter((r) => r.batteryTypeId === 'energy');

  // Domain layer stays pure: fetch profile/targets here, pass entries in.
  const { userProfile } = useSettingsStore.getState();
  const targets = nutrientTargetsForProfile(userProfile);
  const { days, weekly } = summarizeWeeklyNutrition(foodLog, targets, getAnyFoodById, language);

  // Sheet 0a: Daily Totals — one row per day with logged food, macro sums,
  // carried-forward weight, burned kcal (activity log), estimated energy
  // need (energy battery capacity) + balance, and a trailing disclaimer row
  // (see domain/nutrition/excelSheets.ts).
  const dailyTotalsRows = buildDailyTotals(foodLog, weights, activityLog, energyReadings, language);

  // Sheet 0b: Food Entries — one row per logged food, blank-row separated by
  // calendar day (the free `xlsx` build can't style cell fills/borders), plus
  // per-entry micronutrients scaled from the food's per-100g figures.
  const foodEntryRows = buildFoodEntryRows(foodLog, getAnyFoodById, language);

  // Sheet 1: Battery readings
  const readingRows = readings.map((r) => ({
    [t('export.columns.date')]: r.date,
    [t('export.columns.battery')]: batteryTypeName(r.batteryTypeId, language),
    [t('export.columns.level')]: r.level,
    [t('export.columns.capacity')]: r.capacity,
    [t('export.columns.percentage')]: Math.round((r.level / r.capacity) * 100),
  }));

  // Sheet 2: Intake events
  const intakeRows = intakes.map((e) => ({
    [t('export.columns.date')]: new Date(e.timestamp).toLocaleDateString(localeTag),
    [t('export.columns.time')]: new Date(e.timestamp).toLocaleTimeString(localeTag),
    [t('export.columns.battery')]: batteryTypeName(e.batteryTypeId, language),
    [t('export.columns.amount')]: e.amount,
    [t('export.columns.note')]: e.note,
  }));

  // Sheet 3: Food log (rich per-meal rows — food, grams, meal type, kcal, macro).
  // Food name follows the export language via the live catalog lookup (see
  // foodLogEntryDisplayName in foodLookup.ts); only a custom food deleted by
  // the user, or a since-removed catalog id, falls back to the frozen
  // foodNameVi snapshot taken at log time.
  const foodRows = foodLog.map((f) => ({
    [t('export.columns.date')]: new Date(f.timestamp).toLocaleDateString(localeTag),
    [t('export.columns.time')]: new Date(f.timestamp).toLocaleTimeString(localeTag),
    [t('export.columns.meal')]: mealLabel(f.mealType, language),
    [t('export.columns.foodName')]: foodLogEntryDisplayName(f, language),
    [t('export.columns.grams')]: f.grams,
    [t('export.columns.kcal')]: f.energyKcal,
    [t('export.columns.protein')]: f.proteinG,
    [t('export.columns.fat')]: f.fatG,
    [t('export.columns.carbs')]: f.carbG,
    [t('export.columns.water')]: f.waterG,
    [t('export.columns.minerals')]: f.mineralsMg,
  }));

  // Sheet 4: Nutrition by day — one row per day with logged food, macro totals
  // + each micronutrient's current/target, plus the gentle daily assessment.
  const nutritionDayRows = days.map((day) => {
    const row: Record<string, string | number> = {
      [t('export.columns.date')]: formatDisplayDate(day.date, language),
      [t('export.columns.kcal')]: day.kcal,
      [t('export.columns.protein')]: day.proteinG,
      [t('export.columns.fat')]: day.fatG,
      [t('export.columns.carbs')]: day.carbG,
    };
    for (const id of ASSESSMENT_ORDER) {
      const micro = day.micros.find((m) => m.id === id);
      if (micro) {
        row[t(`nutrients.${id}.name`)] = `${micro.current}/${micro.target} ${micro.unit}`;
      }
    }
    row[t('export.columns.assessment')] = day.assessment;
    return row;
  });

  // Sheet 5: Weekly summary — 7-day average vs target per nutrient.
  const weeklySummaryRows = weekly.map((w) => ({
    [t('export.columns.nutrient')]: t(`nutrients.${w.id}.name`),
    [t('export.columns.avgPerDay')]: `${w.avgPerDay} ${w.unit}`,
    [t('export.columns.recommendedPerDay')]: `${w.target} ${w.unit}`,
    [t('export.columns.pctReached')]: w.pctOfTarget,
    [t('export.columns.assessment')]: w.assessment,
  }));

  // Sheet 6: Reference thresholds — the threshold/advice/source table that
  // drives the assessment columns above (see domain/nutrition/
  // nutritionAssessment.ts ASSESSMENT_RULES). Disclaimer is the first row.
  const referenceRows: Record<string, string>[] = [
    {
      [t('export.columns.nutrient')]: '',
      [t('export.columns.threshold')]: '',
      [t('export.columns.advice')]: t('assessment.disclaimer'),
      [t('export.columns.source')]: '',
    },
  ];
  for (const id of ASSESSMENT_ORDER) {
    const rule = ASSESSMENT_RULES[id];
    const target = targets.find((tg) => tg.id === id);
    const name = t(`nutrients.${id}.name`);
    const unit = target?.unit ?? '';
    const value = target?.value ?? 0;
    const underAdvice = t(`nutrients.${id}.underAdvice`);
    const overAdvice = t(`nutrients.${id}.overAdvice`);
    if (rule.underThreshold !== undefined && underAdvice) {
      referenceRows.push({
        [t('export.columns.nutrient')]: name,
        [t('export.columns.threshold')]: t('export.thresholdUnder', {
          pct: Math.round(rule.underThreshold * 100),
          value: round1(rule.underThreshold * value),
          unit,
        }),
        [t('export.columns.advice')]: underAdvice,
        [t('export.columns.source')]: rule.sourceUrl,
      });
    }
    if (rule.overThreshold !== undefined && overAdvice) {
      referenceRows.push({
        [t('export.columns.nutrient')]: name,
        [t('export.columns.threshold')]: t('export.thresholdOver', {
          pct: Math.round(rule.overThreshold * 100),
          value: round1(rule.overThreshold * value),
          unit,
        }),
        [t('export.columns.advice')]: overAdvice,
        [t('export.columns.source')]: rule.sourceUrl,
      });
    }
  }

  const wb = utils.book_new();

  const dailyTotalsSheet = utils.json_to_sheet(dailyTotalsRows);
  autoFitColumns(dailyTotalsSheet);
  utils.book_append_sheet(wb, dailyTotalsSheet, t('export.sheets.dailyTotals'));

  const foodEntriesSheet = utils.json_to_sheet(foodEntryRows);
  autoFitColumns(foodEntriesSheet);
  utils.book_append_sheet(wb, foodEntriesSheet, t('export.sheets.foodEntries'));

  const readingsSheet = utils.json_to_sheet(readingRows);
  autoFitColumns(readingsSheet);
  utils.book_append_sheet(wb, readingsSheet, t('export.sheets.batteryReadings'));

  const intakeSheet = utils.json_to_sheet(intakeRows);
  autoFitColumns(intakeSheet);
  utils.book_append_sheet(wb, intakeSheet, t('export.sheets.intakeEvents'));

  const foodLogSheet = utils.json_to_sheet(foodRows);
  autoFitColumns(foodLogSheet);
  utils.book_append_sheet(wb, foodLogSheet, t('export.sheets.foodLog'));

  const nutritionDaySheet = utils.json_to_sheet(nutritionDayRows);
  autoFitColumns(nutritionDaySheet);
  utils.book_append_sheet(wb, nutritionDaySheet, t('export.sheets.nutritionByDay'));

  const weeklySummarySheet = utils.json_to_sheet(weeklySummaryRows);
  autoFitColumns(weeklySummarySheet);
  utils.book_append_sheet(wb, weeklySummarySheet, t('export.sheets.weeklySummary'));

  const referenceSheet = utils.json_to_sheet(referenceRows);
  autoFitColumns(referenceSheet);
  utils.book_append_sheet(wb, referenceSheet, t('export.sheets.referenceThresholds'));

  return workbookToBase64WithFrozenHeaders(wb);
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
  const uri = FileSystem.documentDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
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
