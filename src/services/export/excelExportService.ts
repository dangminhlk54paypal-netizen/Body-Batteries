// Expo SDK 54 moved the classic file API behind `/legacy`. The main entry now
// exports the new File/Directory API, where `documentDirectory` /
// `writeAsStringAsync` / `EncodingType` are missing or throw at runtime.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { utils, write } from 'xlsx';
import { getReadingsInRange } from '../../data/repositories/batteryRepository';
import { getIntakeEventsInRange } from '../../data/repositories/intakeRepository';
import { getFoodLogInRange } from '../../data/repositories/foodLogRepository';
import { getWeightHistory } from '../../data/repositories/healthSignalsRepository';
import { todayString, daysAgo, formatDisplayDate } from '../../lib/dateUtils';
import { MEAL_LABELS } from '../../lib/constants';
import { useSettingsStore } from '../../store/settingsStore';
import { nutrientTargetsForProfile } from '../../lib/nutrientTargets';
import { getAnyFoodById } from '../../data/food/foodLookup';
import { summarizeWeeklyNutrition } from '../../domain/nutrition/dailyNutritionSummary';
import { buildDailyTotals, buildFoodEntryRows } from '../../domain/nutrition/excelSheets';
import {
  ASSESSMENT_RULES,
  ASSESSMENT_ORDER,
  DISCLAIMER_VI,
} from '../../domain/nutrition/nutritionAssessment';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Build the .xlsx (all 8 sheets) for an arbitrary date range and return it as a
// base64 string. Does the DB reads but no file I/O — shared by every export.
async function buildWorkbookBase64(fromDate: string, toDate: string): Promise<string> {
  const readings = await getReadingsInRange(fromDate, toDate);
  const intakes = await getIntakeEventsInRange(fromDate, toDate);
  const foodLog = await getFoodLogInRange(fromDate, toDate);
  const weights = await getWeightHistory(1000);

  // Domain layer stays pure: fetch profile/targets here, pass entries in.
  const { userProfile } = useSettingsStore.getState();
  const targets = nutrientTargetsForProfile(userProfile);
  const { days, weekly } = summarizeWeeklyNutrition(foodLog, targets, getAnyFoodById);

  // Sheet 0a: Daily Totals — one row per day with logged food, macro sums +
  // carried-forward weight (see domain/nutrition/excelSheets.ts).
  const dailyTotalsRows = buildDailyTotals(foodLog, weights);

  // Sheet 0b: Food Entries — one row per logged food, blank-row separated by
  // calendar day (the free `xlsx` build can't style cell fills/borders).
  const foodEntryRows = buildFoodEntryRows(foodLog);

  // Sheet 1: Battery readings
  const readingRows = readings.map((r) => ({
    Date: r.date,
    Battery: r.batteryTypeId,
    Level: r.level,
    Capacity: r.capacity,
    'Percentage (%)': Math.round((r.level / r.capacity) * 100),
  }));

  // Sheet 2: Intake events
  const intakeRows = intakes.map((e) => ({
    Date: new Date(e.timestamp).toLocaleDateString('vi-VN'),
    Time: new Date(e.timestamp).toLocaleTimeString('vi-VN'),
    Battery: e.batteryTypeId,
    Amount: e.amount,
    Note: e.note,
  }));

  // Sheet 3: Food log (rich per-meal rows — món, gram, loại bữa, kcal, macro)
  const foodRows = foodLog.map((f) => ({
    Ngày: new Date(f.timestamp).toLocaleDateString('vi-VN'),
    Giờ: new Date(f.timestamp).toLocaleTimeString('vi-VN'),
    'Bữa': MEAL_LABELS[f.mealType],
    'Món ăn': f.foodNameVi,
    'Gram': f.grams,
    'Kcal': f.energyKcal,
    'Đạm (g)': f.proteinG,
    'Béo (g)': f.fatG,
    'Carbs (g)': f.carbG,
    'Nước (ml)': f.waterG,
    'Khoáng (mg)': f.mineralsMg,
  }));

  // Sheet 4: Dinh dưỡng ngày — one row per day with logged food, macro totals
  // + each micronutrient's current/target, plus the gentle daily assessment.
  const nutritionDayRows = days.map((day) => {
    const row: Record<string, string | number> = {
      Ngày: formatDisplayDate(day.date),
      Kcal: day.kcal,
      'Đạm (g)': day.proteinG,
      'Béo (g)': day.fatG,
      'Carbs (g)': day.carbG,
    };
    for (const id of ASSESSMENT_ORDER) {
      const micro = day.micros.find((m) => m.id === id);
      if (micro) {
        row[micro.nameVi] = `${micro.current}/${micro.target} ${micro.unit}`;
      }
    }
    row['Đánh giá'] = day.assessment;
    return row;
  });

  // Sheet 5: Tổng kết tuần — 7-day average vs target per nutrient.
  const weeklySummaryRows = weekly.map((w) => ({
    'Chất': w.nameVi,
    'TB/ngày': `${w.avgPerDay} ${w.unit}`,
    'Khuyến nghị/ngày': `${w.target} ${w.unit}`,
    '% đạt': w.pctOfTarget,
    'Đánh giá': w.assessment,
  }));

  // Sheet 6: Bảng ngưỡng tham chiếu — the threshold/advice/source table that
  // drives the "Đánh giá" columns above (see domain/nutrition/
  // nutritionAssessment.ts ASSESSMENT_RULES). Disclaimer is the first row.
  const referenceRows: Record<string, string>[] = [
    { 'Chất': '', 'Ngưỡng': '', 'Lời góp ý': DISCLAIMER_VI, 'Nguồn (URL)': '' },
  ];
  for (const id of ASSESSMENT_ORDER) {
    const rule = ASSESSMENT_RULES[id];
    const target = targets.find((t) => t.id === id);
    const nameVi = target?.nameVi ?? id;
    const unit = target?.unit ?? '';
    const value = target?.value ?? 0;
    if (rule.underThreshold !== undefined && rule.underAdviceVi) {
      referenceRows.push({
        'Chất': nameVi,
        'Ngưỡng': `Dưới ${Math.round(rule.underThreshold * 100)}% mục tiêu (${round1(
          rule.underThreshold * value
        )} ${unit})`,
        'Lời góp ý': rule.underAdviceVi,
        'Nguồn (URL)': rule.sourceUrl,
      });
    }
    if (rule.overThreshold !== undefined && rule.overAdviceVi) {
      referenceRows.push({
        'Chất': nameVi,
        'Ngưỡng': `Trên ${Math.round(rule.overThreshold * 100)}% mục tiêu (${round1(
          rule.overThreshold * value
        )} ${unit})`,
        'Lời góp ý': rule.overAdviceVi,
        'Nguồn (URL)': rule.sourceUrl,
      });
    }
  }

  const wb = utils.book_new();

  const dailyTotalsSheet = utils.json_to_sheet(dailyTotalsRows);
  dailyTotalsSheet['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
  utils.book_append_sheet(wb, dailyTotalsSheet, 'Daily Totals');

  const foodEntriesSheet = utils.json_to_sheet(foodEntryRows);
  foodEntriesSheet['!cols'] = [
    { wch: 14 },
    { wch: 10 },
    { wch: 24 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
  ];
  utils.book_append_sheet(wb, foodEntriesSheet, 'Food Entries');

  utils.book_append_sheet(wb, utils.json_to_sheet(readingRows), 'Battery Readings');
  utils.book_append_sheet(wb, utils.json_to_sheet(intakeRows), 'Intake Events');
  utils.book_append_sheet(wb, utils.json_to_sheet(foodRows), 'Food Log');
  utils.book_append_sheet(wb, utils.json_to_sheet(nutritionDayRows), 'Dinh dưỡng ngày');
  utils.book_append_sheet(wb, utils.json_to_sheet(weeklySummaryRows), 'Tổng kết tuần');
  utils.book_append_sheet(wb, utils.json_to_sheet(referenceRows), 'Bảng ngưỡng tham chiếu');

  return write(wb, { type: 'base64', bookType: 'xlsx' });
}

// Build + write the workbook for a date range into the app document directory
// (persistent, visible in Files). Returns the file URI and does NOT open the
// share sheet — used by the silent monthly auto-export.
export async function exportDataInRangeToFile(
  fromDate: string,
  toDate: string,
  filename: string
): Promise<string> {
  const base64 = await buildWorkbookBase64(fromDate, toDate);
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
  filename: string
): Promise<void> {
  const uri = await exportDataInRangeToFile(fromDate, toDate, filename);
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Xuất dữ liệu Body Batteries',
    });
  }
}

// Last 7 days (unchanged behaviour / filename).
export async function exportWeeklyData(): Promise<void> {
  const toDate = todayString();
  const fromDate = daysAgo(7);
  await exportDataInRange(fromDate, toDate, `body_batteries_${fromDate}_${toDate}.xlsx`);
}

// Last 30 days — on-demand full-month export.
export async function exportMonthlyData(): Promise<void> {
  await exportDataInRange(daysAgo(30), todayString(), 'body_batteries_last_30_days.xlsx');
}
