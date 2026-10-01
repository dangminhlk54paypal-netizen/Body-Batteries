import type { FoodItem, FoodLogEntry } from '../../types/food';
import type { ActivityLogEntry, UserProfile } from '../../types/energy';
import type { BatteryReading, IntakeEvent } from '../../types/battery';
import type { MicronutrientId, NutrientTarget } from '../../types/nutrition';
import { DEFAULT_BATTERIES, ENERGY_BATTERY, batteryTypeName, mealLabel } from '../../lib/constants';
import { workoutLabel } from '../../lib/activityLabels';
import { dateString, weekdayLabel } from '../../lib/dateUtils';
import { translate } from '../../i18n/translate';
import { LOCALE_TAGS } from '../../i18n/types';
import type { Language } from '../../i18n/types';
import { computeDailyBatteryTotals } from '../battery/dailyBatteryTotals';
import { computeMicroBatteries, per100gValue } from '../nutrition/microBatteryEngine';
import { summarizeWeeklyNutrition } from '../nutrition/dailyNutritionSummary';
import { ASSESSMENT_ORDER, ASSESSMENT_RULES, assessState } from '../nutrition/nutritionAssessment';
import { formatLoggedPortion, isPortionCounted } from '../food/portionUnits';
import type { WeightEntryLike } from '../health/weightOnDay';
import { dateCell, round1, timeCell, type SheetTable, type SheetValue } from './sheetTable';

// The data workbook the user exports from Settings (and the monthly
// auto-backup): every sheet as a SheetTable — see sheetTable.ts for the
// "clean table" rules they all follow. Pure: the service fetches, this
// shapes, xlsxWriteUtils writes.
//
// Sheet order = how a person reads it: a "Read me" first, the one-row-per-day
// overview, then the raw logs it is made of, then nutrition notes and the
// reference table, then the internal battery readings and training.

export interface DataWorkbookInput {
  fromDate: string;
  toDate: string;
  exportedOn: string; // YYYY-MM-DD
  language: Language;
  profile: UserProfile;
  targets: NutrientTarget[];
  foodLog: FoodLogEntry[];
  activityLog: ActivityLogEntry[];
  intakeLog: IntakeEvent[];
  readings: BatteryReading[];
  weights: WeightEntryLike[];
  appleHealthBurned: Map<string, number>;
  lookup: (foodId: string) => FoodItem | undefined;
}

// Micronutrient columns of the day and food sheets. Fat is left out: it is
// already a macro column ("Béo (g)"). Sugar and fiber first — the ones people
// watch most.
export const EXPORT_MICRO_IDS: MicronutrientId[] = [
  'sugar',
  'fiber',
  'salt',
  'sodium',
  'calcium',
  'iron',
  'potassium',
  'magnesium',
  'zinc',
  'omega3',
];

type TFn = (key: string, vars?: Record<string, string | number>) => string;
const tFor = (language: Language): TFn => (key, vars) => translate(language, key, vars);

// "Natri (muối)" → "Natri": the header adds its own "(mg)".
function nutrientName(id: MicronutrientId, t: TFn): string {
  return t(`nutrients.${id}.name`).replace(/\s*\(.*\)\s*$/, '');
}

function microHeader(id: MicronutrientId, targets: NutrientTarget[], t: TFn): string {
  const unit = targets.find((x) => x.id === id)?.unit ?? 'g';
  return t('export.columns.withUnit', { name: nutrientName(id, t), unit });
}

const activityDay = (e: ActivityLogEntry) => dateString(new Date(e.startAt ?? e.timestamp));
const dayOf = (ts: number) => dateString(new Date(ts));

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    map.set(k, [...(map.get(k) ?? []), it]);
  }
  return map;
}

function weekdayOf(date: string, language: Language): string {
  const dow = new Date(`${date}T00:00:00`).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  return weekdayLabel(dow, language, 'short');
}

// ---------------------------------------------------------------------------
// "Theo ngày": one row per day that has anything logged — the sheet to chart.

export function buildDailySheet(input: DataWorkbookInput): SheetTable {
  const { language, targets, lookup } = input;
  const t = tFor(language);
  const food = groupBy(input.foodLog, (f) => dayOf(f.timestamp));
  const activity = groupBy(input.activityLog, activityDay);
  const intakes = groupBy(input.intakeLog, (e) => dayOf(e.timestamp));
  const weights = groupBy(
    input.weights.filter((w) => w.value > 0),
    (w) => dayOf(w.timestamp)
  );
  const energy = new Map(input.readings.filter((r) => r.batteryTypeId === 'energy').map((r) => [r.date, r.capacity]));

  const days = [...new Set([...food.keys(), ...activity.keys(), ...intakes.keys(), ...weights.keys()])]
    .filter((d) => d >= input.fromDate && d <= input.toDate)
    .sort();

  const columns = [
    t('export.columns.date'),
    t('export.columns.weekday'),
    t('export.columns.weightKg'),
    t('export.columns.kcalEaten'),
    t('export.columns.protein'),
    t('export.columns.carbs'),
    t('export.columns.fat'),
    t('export.columns.steps'),
    t('export.columns.activityKcal'),
    t('export.columns.burnedTotal'),
    t('export.columns.burnedSource'),
    t('export.columns.balance'),
    t('export.columns.waterMl'),
    t('export.columns.sleepH'),
    ...EXPORT_MICRO_IDS.map((id) => microHeader(id, targets, t)),
  ];

  const rows = days.map((date): SheetValue[] => {
    const dayFood = food.get(date) ?? [];
    const dayWeights = weights.get(date) ?? [];
    const totals = computeDailyBatteryTotals(dayFood, activity.get(date) ?? [], intakes.get(date) ?? []);
    const kcal = round1(dayFood.reduce((s, f) => s + f.energyKcal, 0));
    const fat = round1(dayFood.reduce((s, f) => s + f.fatG, 0));
    // Total burn for the day: Apple Health when synced, else the app's own
    // estimate (the energy battery's capacity) — the source column says which.
    const health = input.appleHealthBurned.get(date);
    const burned = health ?? energy.get(date);
    const micros = dayFood.length > 0 ? computeMicroBatteries(dayFood, lookup, targets) : [];
    return [
      dateCell(date),
      weekdayOf(date, language),
      // Measured that day (average of the day's weigh-ins) — never carried
      // forward, so a chart shows real readings only.
      dayWeights.length > 0 ? round1(dayWeights.reduce((s, w) => s + w.value, 0) / dayWeights.length) : null,
      dayFood.length > 0 ? kcal : null,
      dayFood.length > 0 ? totals.protein : null,
      dayFood.length > 0 ? totals.carbs : null,
      dayFood.length > 0 ? fat : null,
      totals.movementSteps || null,
      totals.movementKcal || null,
      burned != null ? Math.round(burned) : null,
      health != null
        ? t('export.values.burnedAppleHealth')
        : burned != null
          ? t('export.values.burnedEstimate')
          : null,
      burned != null && dayFood.length > 0 ? Math.round(kcal - burned) : null,
      totals.water || null,
      totals.sleep || null,
      ...EXPORT_MICRO_IDS.map((id) => micros.find((m) => m.id === id)?.current ?? null),
    ];
  });

  return { name: t('export.sheets.daily'), columns, rows };
}

// ---------------------------------------------------------------------------
// "Món ăn": one row per logged food, oldest first.

export function buildFoodSheet(input: DataWorkbookInput): SheetTable {
  const { language, targets, lookup } = input;
  const t = tFor(language);
  const columns = [
    t('export.columns.date'),
    t('export.columns.time'),
    t('export.columns.meal'),
    t('export.columns.food'),
    t('export.columns.portion'),
    t('export.columns.grams'),
    t('export.columns.kcal'),
    t('export.columns.protein'),
    t('export.columns.carbs'),
    t('export.columns.fat'),
    t('export.columns.waterMl'),
    ...EXPORT_MICRO_IDS.map((id) => microHeader(id, targets, t)),
  ];
  const rows = [...input.foodLog]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((e): SheetValue[] => {
      const item = lookup(e.foodId);
      const name = item
        ? language === 'de'
          ? item.nameDe || item.nameEn || item.nameVi
          : language === 'en'
            ? item.nameEn || item.nameVi
            : item.nameVi
        : e.foodNameVi;
      const factor = Math.max(0, e.grams) / 100;
      return [
        dateCell(dayOf(e.timestamp)),
        timeCell(e.timestamp),
        mealLabel(e.mealType, language),
        name,
        // Only for counted portions ("2 viên", "1 hộp") — a plain gram entry
        // would just repeat the Gram column.
        isPortionCounted(e.portionUnit) ? formatLoggedPortion(e, item, language) : null,
        e.grams,
        e.energyKcal,
        e.proteinG,
        e.carbG,
        e.fatG,
        round1(e.waterG),
        // Blank (not 0) when the food is no longer in the catalog: unknown ≠ none.
        ...EXPORT_MICRO_IDS.map((id) => (item ? round1(per100gValue(item.per100g, id) * factor) : null)),
      ];
    });
  return { name: t('export.sheets.foods'), columns, rows };
}

// ---------------------------------------------------------------------------
// "Vận động": one row per logged activity entry.

export function buildActivitySheet(input: DataWorkbookInput): SheetTable {
  const { language } = input;
  const t = tFor(language);
  const columns = [
    t('export.columns.date'),
    t('export.columns.start'),
    t('export.columns.end'),
    t('export.columns.activity'),
    t('export.columns.minutes'),
    t('export.columns.steps'),
    t('export.columns.kcal'),
  ];
  const rows = [...input.activityLog]
    .sort((a, b) => (a.startAt ?? a.timestamp) - (b.startAt ?? b.timestamp))
    .map((e): SheetValue[] => {
      const minutes = e.workouts.reduce((s, w) => s + w.minutes, 0);
      return [
        dateCell(activityDay(e)),
        timeCell(e.startAt ?? e.timestamp),
        e.endAt != null ? timeCell(e.endAt) : null,
        e.workouts.length > 0
          ? e.workouts.map((w) => workoutLabel(w, language)).join(' + ')
          : t('export.values.stepsOnly'),
        minutes > 0 ? Math.round(minutes) : null,
        e.steps || null,
        Math.round(e.energyKcal),
      ];
    });
  return { name: t('export.sheets.activity'), columns, rows };
}

// ---------------------------------------------------------------------------
// "Nạp nhanh": water / sleep (and older manual charges), oldest first.

function unitLabel(unit: string, t: TFn): string {
  return unit === 'steps' ? t('export.values.stepsUnit') : unit;
}

export function buildQuickLogSheet(input: DataWorkbookInput): SheetTable {
  const { language } = input;
  const t = tFor(language);
  const columns = [
    t('export.columns.date'),
    t('export.columns.time'),
    t('export.columns.type'),
    t('export.columns.amount'),
    t('export.columns.unit'),
    t('export.columns.note'),
  ];
  const rows = [...input.intakeLog]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((e): SheetValue[] => [
      dateCell(dayOf(e.timestamp)),
      timeCell(e.timestamp),
      batteryTypeName(e.batteryTypeId, language),
      e.amount,
      unitLabel(DEFAULT_BATTERIES.find((b) => b.id === e.batteryTypeId)?.unit ?? '', t),
      e.note || null,
    ]);
  return { name: t('export.sheets.quickLogs'), columns, rows };
}

// ---------------------------------------------------------------------------
// Nutrition vs the general reference marks.

function loggedDays(input: DataWorkbookInput) {
  // Averages divide by the days that have food logged: a day the app wasn't
  // used says nothing about what was eaten (and a 30-day export must not
  // divide by 7). The sheet shows the count, so the basis is never hidden.
  const count = new Set(input.foodLog.map((f) => dayOf(f.timestamp))).size;
  const summary = summarizeWeeklyNutrition(input.foodLog, input.targets, input.lookup, input.language, Math.max(1, count));
  return { summary, count };
}

export function buildPeriodAveragesSheet(input: DataWorkbookInput): SheetTable {
  const t = tFor(input.language);
  const { summary, count } = loggedDays(input);
  const columns = [
    t('export.columns.nutrient'),
    t('export.columns.unit'),
    t('export.columns.kind'),
    t('export.columns.avgPerDay'),
    t('export.columns.recommendedPerDay'),
    t('export.columns.pctReached'),
    t('export.columns.daysCounted'),
    t('export.columns.assessment'),
  ];
  const order = new Map(ASSESSMENT_ORDER.map((id, i) => [id, i]));
  const rows = [...summary.weekly]
    .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
    .map((w): SheetValue[] => [
      nutrientName(w.id, t),
      w.unit,
      t(w.kind === 'limit' ? 'export.values.kindLimit' : 'export.values.kindGoal'),
      w.avgPerDay,
      w.target,
      w.pctOfTarget,
      count,
      w.assessment,
    ]);
  return { name: t('export.sheets.periodAverages'), columns, rows: count > 0 ? rows : [] };
}

// One row per (day, nutrient) worth a note — filter by nutrient to see how
// often it comes up.
export function buildDailyNotesSheet(input: DataWorkbookInput): SheetTable {
  const t = tFor(input.language);
  const { summary } = loggedDays(input);
  const columns = [
    t('export.columns.date'),
    t('export.columns.nutrient'),
    t('export.columns.unit'),
    t('export.columns.eaten'),
    t('export.columns.recommendedPerDay'),
    t('export.columns.pctReached'),
    t('export.columns.advice'),
  ];
  const rows: SheetValue[][] = [];
  for (const day of summary.days) {
    for (const id of ASSESSMENT_ORDER) {
      const m = day.micros.find((x) => x.id === id);
      const note = m ? assessState(m, input.language) : null;
      if (!m || !note) continue;
      rows.push([dateCell(day.date), nutrientName(id, t), m.unit, m.current, m.target, m.percentage, note]);
    }
  }
  return { name: t('export.sheets.dailyNotes'), columns, rows };
}

export function buildReferenceSheet(input: DataWorkbookInput): SheetTable {
  const t = tFor(input.language);
  const columns = [
    t('export.columns.nutrient'),
    t('export.columns.unit'),
    t('export.columns.recommendedPerDay'),
    t('export.columns.threshold'),
    t('export.columns.advice'),
    t('export.columns.source'),
  ];
  const rows: SheetValue[][] = [];
  for (const id of ASSESSMENT_ORDER) {
    const rule = ASSESSMENT_RULES[id];
    const target = input.targets.find((x) => x.id === id);
    if (!rule || !target) continue;
    const name = nutrientName(id, t);
    const under = t(`nutrients.${id}.underAdvice`);
    const over = t(`nutrients.${id}.overAdvice`);
    if (rule.underThreshold !== undefined && under) {
      rows.push([
        name,
        target.unit,
        target.value,
        t('export.thresholdUnder', {
          pct: Math.round(rule.underThreshold * 100),
          value: round1(rule.underThreshold * target.value),
          unit: target.unit,
        }),
        under,
        rule.sourceUrl,
      ]);
    }
    if (rule.overThreshold !== undefined && over) {
      rows.push([
        name,
        target.unit,
        target.value,
        t('export.thresholdOver', {
          pct: Math.round(rule.overThreshold * 100),
          value: round1(rule.overThreshold * target.value),
          unit: target.unit,
        }),
        over,
        rule.sourceUrl,
      ]);
    }
  }
  return { name: t('export.sheets.referenceThresholds'), columns, rows };
}

// ---------------------------------------------------------------------------
// "Pin": the app's daily battery readings (internal gauges, long format —
// pivot on Pin to compare them).

const BATTERY_ORDER = [ENERGY_BATTERY, ...DEFAULT_BATTERIES];

export function buildBatterySheet(input: DataWorkbookInput): SheetTable {
  const { language } = input;
  const t = tFor(language);
  const columns = [
    t('export.columns.date'),
    t('export.columns.battery'),
    t('export.columns.level'),
    t('export.columns.capacity'),
    t('export.columns.unit'),
    t('export.columns.percentage'),
  ];
  const rank = (id: string) => {
    const i = BATTERY_ORDER.findIndex((b) => b.id === id);
    return i < 0 ? 99 : i;
  };
  const rows = input.readings
    .filter((r) => r.batteryTypeId !== 'master')
    .sort((a, b) => a.date.localeCompare(b.date) || rank(a.batteryTypeId) - rank(b.batteryTypeId))
    .map((r): SheetValue[] => [
      dateCell(r.date),
      batteryTypeName(r.batteryTypeId, language),
      round1(r.level),
      round1(r.capacity),
      unitLabel(BATTERY_ORDER.find((b) => b.id === r.batteryTypeId)?.unit ?? '', t),
      r.capacity > 0 ? Math.round((r.level / r.capacity) * 100) : null,
    ]);
  return { name: t('export.sheets.batteryReadings'), columns, rows };
}

// ---------------------------------------------------------------------------
// "Đọc trước": what the file covers, how each sheet is laid out, and the
// medical disclaimer — so the data sheets carry no note rows.

function longDate(date: string, language: Language): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(LOCALE_TAGS[language], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Which guide line goes with which sheet (by the sheet's translated name).
export type SheetGuideKey =
  | 'daily'
  | 'foods'
  | 'activity'
  | 'quickLogs'
  | 'periodAverages'
  | 'dailyNotes'
  | 'referenceThresholds'
  | 'batteryReadings'
  | 'strengthProgress'
  | 'liftMaxes';

export function buildReadMeSheet(
  input: DataWorkbookInput,
  sheets: { key: SheetGuideKey; table: SheetTable }[]
): SheetTable {
  const { language, profile } = input;
  const t = tFor(language);
  const foodDays = new Set(input.foodLog.map((f) => dayOf(f.timestamp))).size;
  const rows: SheetValue[][] = [
    [t('export.readMe.period'), `${longDate(input.fromDate, language)} – ${longDate(input.toDate, language)}`],
    [t('export.readMe.exportedOn'), longDate(input.exportedOn, language)],
    [
      t('export.readMe.profile'),
      t('export.readMe.profileValue', {
        sex: t(profile.sex === 'male' ? 'export.readMe.sexMale' : 'export.readMe.sexFemale'),
        age: profile.age,
        height: profile.heightCm,
        weight: profile.weightKg,
      }),
    ],
    [t('export.readMe.foodDays'), foodDays],
    [t('export.readMe.howTo'), t('export.readMe.howToText')],
    ...sheets.map(({ key, table }): SheetValue[] => [
      t('export.readMe.sheetLine', { name: table.name, rows: table.rows.length }),
      t(`export.readMe.guide.${key}`),
    ]),
    [t('export.readMe.note'), t('assessment.disclaimer')],
  ];
  return {
    name: t('export.sheets.readMe'),
    columns: [t('export.readMe.colItem'), t('export.readMe.colValue')],
    rows,
  };
}
