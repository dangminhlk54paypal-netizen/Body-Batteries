import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, FlatList, StyleSheet, Keyboard, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useEnergyStore } from '../../store/energyStore';
import { useChargeEffectStore } from '../../store/chargeEffectStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useMealTextDraftStore } from '../../store/mealTextDraftStore';
import { loadLibraryCandidates, searchForMealText } from '../../data/food/mealTextSearch';
import { useLibrarySearch } from '../../hooks/useLibrarySearch';
import { getAnyFoodById, foodDisplayName, foodLogEntryDisplayName } from '../../data/food/foodLookup';
import { addCustomFoodAndRegister } from '../../data/food/customFoodRegistry';
import { upsertOverrideAndRegister } from '../../data/food/foodOverrideRegistry';
import { parseDayText, splitDayItems } from '../../domain/dayText/parseDayText';
import { buildActivityNames, type ActivityMatch } from '../../domain/energy/activityText/parseActivityText';
import {
  ACTIVITY_INFO_ISSUES,
  activityDraftTotals,
  activityLogPlan,
  buildActivityDraft,
  isActivityBlocked,
  isSetBased,
  rowActivityKcal,
  rowSteps,
  toggleActivityRow,
  withActivityMatch,
  withActivityMinutes,
  withActivitySets,
  withActivitySteps,
  withActivityTime,
  type ActivityDraftIssue,
  type ActivityDraftRow,
  type ActivityTextContext,
} from '../../domain/energy/activityText/mapActivityText';
import { parseSetNotation } from '../../domain/training/setNotation';
import { formatSetSequence } from '../../domain/training/trainingLogFormatter';
import { getActivityLogInRange } from '../../data/repositories/activityLogRepository';
import { ACTIVITY_CATEGORIES } from '../../lib/activityCategories';
import { activityLabel, workoutLabel } from '../../lib/activityLabels';
import { resolveTrainingLogFormat } from '../../types/trainingLog';
import { LIFTING_EXERCISES, type ActivityLogEntry } from '../../types/energy';
import {
  aiSavePlan,
  atLocalTime,
  buildMealDraft,
  draftTotals,
  hasExactFood,
  INFO_ISSUES,
  isBlocked,
  manualRow,
  rowKcal,
  stepAmount,
  toggleRow,
  withAiChoice,
  withAiName,
  withAmount,
  withFood,
  withSavedFood,
  withTimestamp,
  type AiChoice,
  type MealDraftIssue,
  type MealDraftRow,
  type MealTextContext,
} from '../../domain/food/mealText/mapMealText';
import { isDraftFresh } from '../../domain/energy/activityDraft';
import { mealTypeForTimestamp } from '../../domain/food/foodNutrition';
import {
  formatLoggedPortion,
  formatMeasure,
  formatPortionCount,
  measureUnitOf,
  portionUnitNoun,
} from '../../domain/food/portionUnits';
import { BACKFILL_MAX_DAYS_BACK, mealLabel } from '../../lib/constants';
import { addDaysToDateString, dateString, todayString } from '../../lib/dateUtils';
import { parseDecimal } from '../../lib/units';
import * as haptics from '../../lib/haptics';
import type { FoodItem, FoodLogEntry, Nutrition } from '../../types/food';
import type { ThemeColors } from '../../lib/theme';
import { useThemeColors, useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';
import { LOCALE_TAGS } from '../../i18n';

// "Nạp bằng chữ" — one box for typed, dictated (the keyboard's 🎤) or pasted
// text, read by domain/food/mealText (Parsing → Decoding → Mapping &
// Validation) into rows the user ticks, fixes and only then logs (Insert,
// through the same logFood / logFoodForPastDate as the ⚡ Nạp list).
//
// "Kể cả ngày" (the ⌨️ 🎤 button under Nạp | Xả opens this same box): the
// text may also tell workouts — domain/dayText cuts it into foods and
// workouts, and the workouts become a second list (🔥 Xả,
// energy/activityText) logged through logActivity / logActivityForPastDate
// like the 🔥 Xả sheet.
//
// Lives INSIDE FoodLogModal's sheet: the row editor, the food picker and the
// whole-list time editor replace the list in place — a second Modal on top of
// a BottomSheet does not show on iOS (mobile-ui-density §3).
//
// A pasted AI nutrition analysis gives rows with numbers (mapMealText AiRow):
// the row editor compares them with the app's food and lets the user keep the
// app's numbers, update the food with the AI's, or save it as a new "Món của
// tôi". The foods are written on "Nạp" (or "💾 Lưu" without logging).

interface Props {
  // The day the sheet is logging for (today, or a past day from History).
  baseDate: string;
  recentLog: FoodLogEntry[];
  onBack: () => void;
  onClose: () => void;
  onLogged: () => void;
  // 'day' when opened from "⌨️ 🎤 Kể cả ngày" — only the title and the
  // example differ; foods and workouts are read either way.
  variant?: 'meal' | 'day';
}

type Screen =
  | { kind: 'list' }
  | { kind: 'edit'; id: string }
  | { kind: 'activityEdit'; id: string }
  | { kind: 'pick'; id: string | null } // null = add a new row
  | { kind: 'batchTime' };

const LIST_HEIGHT = 300;
const AI_CHOICES: AiChoice[] = ['app', 'ai', 'new'];
// The rows of the app/AI comparison: the macros always, the rest when stated.
type AiLabel = 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium';
const AI_TABLE: { key: keyof Nutrition; label: AiLabel; always: boolean }[] = [
  { key: 'energyKcal', label: 'kcal', always: true },
  { key: 'proteinG', label: 'protein', always: true },
  { key: 'carbG', label: 'carbs', always: true },
  { key: 'fatG', label: 'fat', always: true },
  { key: 'fiberG', label: 'fiber', always: false },
  { key: 'sugarG', label: 'sugar', always: false },
  { key: 'sodiumMg', label: 'sodium', always: false },
];
const PICK_LIMIT = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
// How far back "as usual" lengths and Xả duplicates are looked up.
const RECENT_ACTIVITY_DAYS = 30;
const MINUTE_STEP = 5;
const STEP_STEP = 500;

// Impure reads live in module-level helpers so the components' purity
// analysis never sees them (same pattern as FoodLogModal).
function nowTimestamp(): number {
  return Date.now();
}

// Same id shape as buildCustomFoodItem (customFoodInput.ts).
function newCustomFoodId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// The Xả entries "as usual" lengths and duplicates are read from; none when
// the database can't be read (the rows then just have no "usual").
async function loadRecentActivities(today: string): Promise<ActivityLogEntry[]> {
  try {
    return await getActivityLogInRange(addDaysToDateString(today, -RECENT_ACTIVITY_DAYS), today);
  } catch {
    return [];
  }
}

function sameMatch(a: ActivityMatch | null, b: ActivityMatch | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function restoreDraftText(): string {
  const { text, savedAt } = useMealTextDraftStore.getState();
  return isDraftFresh(savedAt, Date.now()) ? text : '';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Whole days from `today` to the day of `timestamp` (0 today, -1 yesterday…).
function dayOffsetOf(timestamp: number, today: string): number {
  return Math.round((atLocalTime(dateString(new Date(timestamp)), 0, 0) - atLocalTime(today, 0, 0)) / DAY_MS);
}

export function TextMealEntry({ baseDate, recentLog, onBack, onClose, onLogged, variant = 'meal' }: Props) {
  const { t, language } = useT();
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const logFood = useEnergyStore((s) => s.logFood);
  const logFoodForPastDate = useEnergyStore((s) => s.logFoodForPastDate);
  const logActivity = useEnergyStore((s) => s.logActivity);
  const logActivityForPastDate = useEnergyStore((s) => s.logActivityForPastDate);
  const mealWindows = useSettingsStore((s) => s.mealWindows);
  const profile = useSettingsStore((s) => s.userProfile);
  const customActivities = useSettingsStore((s) => s.customActivities);
  const customExercises = useSettingsStore((s) => s.customExercises);
  const trainingLogFormat = useSettingsStore((s) => s.trainingLogFormat);

  const [text, setText] = useState(restoreDraftText);
  const [showHint, setShowHint] = useState(false);
  const [rows, setRows] = useState<MealDraftRow[] | null>(null);
  const [activityRows, setActivityRows] = useState<ActivityDraftRow[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityLogEntry[]>([]);
  // "Today" as of the last analysis — labels in render read this, never the clock.
  const [today, setToday] = useState('');
  const [view, setView] = useState<Screen>({ kind: 'list' });
  const [saving, setSaving] = useState(false);
  // Row editor / time editor fields (strings while typing).
  const [editAmount, setEditAmount] = useState('');
  const [editHour, setEditHour] = useState('');
  const [editMinute, setEditMinute] = useState('');
  const [editDay, setEditDay] = useState(0);
  const [editName, setEditName] = useState('');
  const [editChoice, setEditChoice] = useState<AiChoice | null>(null);
  const [pickQuery, setPickQuery] = useState('');
  // Workout row editor.
  const [editMatch, setEditMatch] = useState<ActivityMatch | null>(null);
  const [editMinutes, setEditMinutes] = useState('');
  const [editSteps, setEditSteps] = useState('');
  const [editSets, setEditSets] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  // "📋 Dán" found nothing to paste — say so instead of doing nothing.
  const [pasteEmpty, setPasteEmpty] = useState(false);
  const manualIds = useRef(0);

  const preferIds = useMemo(() => new Set(recentLog.map((e) => e.foodId)), [recentLog]);
  // "Nguồn của tôi" rows for the food picker (searched in SQLite as you type).
  const pickLibrary = useLibrarySearch(view.kind === 'pick' ? pickQuery : '');

  function context(library: FoodItem[] = []): MealTextContext {
    return {
      now: nowTimestamp(),
      today: todayString(),
      baseDate,
      maxDaysBack: BACKFILL_MAX_DAYS_BACK,
      mealWindows,
      recentLog,
      search: (q) => searchForMealText(q, preferIds, library),
      resolve: getAnyFoodById,
    };
  }

  const kcalContext = { weightKg: profile.weightKg, heightCm: profile.heightCm, customActivities, customExercises };

  function activityContext(recent: ActivityLogEntry[] = recentActivities): ActivityTextContext {
    return {
      ...kcalContext,
      now: nowTimestamp(),
      today: todayString(),
      baseDate,
      maxDaysBack: BACKFILL_MAX_DAYS_BACK,
      mealWindows,
      recentActivities: recent,
    };
  }

  function updateText(next: string) {
    setText(next);
    setPasteEmpty(false);
    useMealTextDraftStore.getState().save(next);
  }

  async function analyze(source: string = text) {
    if (!source.trim() || analyzing) return;
    Keyboard.dismiss();
    setAnalyzing(true);
    const items = parseDayText(source, buildActivityNames(customActivities, customExercises));
    const foodsSaid = items.flatMap((item) => (item.kind === 'food' ? [item.food] : item.food ? [item.food] : []));
    // The user's imported tables are searched in SQLite first, then the
    // mapping itself runs synchronously over catalog + those candidates.
    const [library, recent] = await Promise.all([loadLibraryCandidates(foodsSaid), loadRecentActivities(todayString())]);
    const ctx = context(library);
    const { foods, activities } = splitDayItems(items, (food) => hasExactFood(food, ctx));
    setToday(ctx.today);
    setRows(buildMealDraft(foods, ctx));
    setRecentActivities(recent);
    setActivityRows(buildActivityDraft(activities, activityContext(recent)));
    setView({ kind: 'list' });
    setAnalyzing(false);
  }

  // "📤 Hỏi AI": the ready-made prompt goes to the share sheet — the user
  // picks ChatGPT / Gemini / Claude, attaches the meal photo there, and
  // copies the JSON answer back. Nothing is sent by the app itself.
  function askAi() {
    Share.share({ message: t('components.textMealEntry.aiPrompt') }).catch(() => {});
  }

  async function paste() {
    const pasted = await Clipboard.getStringAsync().catch(() => '');
    if (!pasted.trim()) {
      setPasteEmpty(true);
      return;
    }
    updateText(pasted);
    await analyze(pasted);
  }

  function replaceRow(id: string, update: (row: MealDraftRow) => MealDraftRow | null) {
    setRows((prev) => {
      if (!prev) return prev;
      const next: MealDraftRow[] = [];
      for (const row of prev) {
        if (row.id !== id) next.push(row);
        else {
          const changed = update(row);
          if (changed) next.push(changed);
        }
      }
      return next;
    });
  }

  function openEdit(row: MealDraftRow) {
    if (!row.food) {
      setPickQuery(row.decoded.foodQuery || row.decoded.raw);
      setView({ kind: 'pick', id: row.id });
      return;
    }
    const at = new Date(row.timestamp);
    setEditAmount(String(row.count ?? Math.round(row.grams)));
    setEditHour(pad2(at.getHours()));
    setEditMinute(pad2(at.getMinutes()));
    setEditDay(dayOffsetOf(row.timestamp, today));
    setEditName(row.ai?.name ?? '');
    setEditChoice(row.ai?.choice ?? null);
    setView({ kind: 'edit', id: row.id });
  }

  function openBatchTime() {
    const first = rows?.[0];
    const at = new Date(first ? first.timestamp : nowTimestamp());
    setEditHour(pad2(at.getHours()));
    setEditMinute(pad2(at.getMinutes()));
    setEditDay(first ? dayOffsetOf(first.timestamp, today) : 0);
    setView({ kind: 'batchTime' });
  }

  function editedTimestamp(): number | null {
    const hour = parseInt(editHour, 10);
    const minute = parseInt(editMinute, 10);
    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return atLocalTime(addDaysToDateString(today, editDay), hour, minute);
  }

  function saveEdit(id: string) {
    const ctx = context();
    const amount = parseDecimal(editAmount);
    const timestamp = editedTimestamp();
    replaceRow(id, (row) => {
      let next = row;
      if (!isNaN(amount) && amount > 0 && amount !== (row.count ?? Math.round(row.grams))) {
        next = withAmount(next, amount, ctx);
      }
      if (timestamp != null && timestamp !== row.timestamp) next = withTimestamp(next, timestamp, ctx);
      if (editChoice) next = withAiChoice(next, editChoice, ctx);
      return withAiName(next, editName, ctx);
    });
    setView({ kind: 'list' });
  }

  function applyBatchTime() {
    const timestamp = editedTimestamp();
    if (timestamp != null) {
      const ctx = context();
      setRows((prev) => prev && prev.map((row) => withTimestamp(row, timestamp, ctx)));
    }
    setView({ kind: 'list' });
  }

  // ── Workout rows ───────────────────────────────────────────────────────

  function replaceActivityRow(id: string, update: (row: ActivityDraftRow) => ActivityDraftRow | null) {
    setActivityRows((prev) => {
      const next: ActivityDraftRow[] = [];
      for (const row of prev) {
        if (row.id !== id) next.push(row);
        else {
          const changed = update(row);
          if (changed) next.push(changed);
        }
      }
      return next;
    });
  }

  function openActivityEdit(row: ActivityDraftRow) {
    const at = row.startAt != null ? new Date(row.startAt) : null;
    setEditMatch(row.match);
    setEditMinutes(row.minutes != null && !isSetBased(row.match) ? String(row.minutes) : '');
    setEditSteps(row.steps > 0 ? String(row.steps) : '');
    setEditSets(row.sets ? formatSetSequence(row.sets, resolveTrainingLogFormat(trainingLogFormat), language) : '');
    setEditHour(at ? pad2(at.getHours()) : '');
    setEditMinute(at ? pad2(at.getMinutes()) : '');
    setEditDay(dayOffsetOf(atLocalTime(row.day, 12, 0), today));
    setView({ kind: 'activityEdit', id: row.id });
  }

  // A workout's start may be left empty — then it has no time (logged now
  // for today, at noon for a past day), like the 🔥 Xả sheet.
  function editedStart(): { day: string; startAt: number | null } | null {
    const day = addDaysToDateString(today, editDay);
    if (editHour === '' && editMinute === '') return { day, startAt: null };
    const startAt = editedTimestamp();
    return startAt == null ? null : { day, startAt };
  }

  function saveActivityEdit(id: string) {
    const ctx = activityContext();
    const minutes = parseDecimal(editMinutes);
    const steps = editSteps.trim() === '' ? 0 : parseDecimal(editSteps);
    const sets = parseSetNotation(editSets);
    const start = editedStart();
    replaceActivityRow(id, (row) => {
      let next = row;
      if (editMatch && !sameMatch(editMatch, row.match)) next = withActivityMatch(next, editMatch, ctx);
      if (isSetBased(next.match)) {
        if (sets.ok) next = withActivitySets(next, sets.sets, ctx);
      } else if (!isNaN(minutes) && minutes > 0 && minutes !== next.minutes) {
        next = withActivityMinutes(next, minutes, ctx);
      }
      if (!isNaN(steps) && steps !== next.steps) next = withActivitySteps(next, steps, ctx);
      if (start && (start.day !== next.day || start.startAt !== next.startAt)) {
        next = withActivityTime(next, start.day, start.startAt, ctx);
      }
      return next;
    });
    setView({ kind: 'list' });
  }

  function stepActivity(row: ActivityDraftRow, direction: 1 | -1) {
    const ctx = activityContext();
    replaceActivityRow(row.id, (r) => {
      if (rowSteps(r) > 0) {
        return withActivitySteps(r, Math.max(STEP_STEP, r.steps + direction * STEP_STEP), ctx);
      }
      const current = r.minutes ?? 0;
      return withActivityMinutes(r, Math.max(MINUTE_STEP, current + direction * MINUTE_STEP), ctx);
    });
  }

  function pick(food: FoodItem, id: string | null) {
    const ctx = context();
    const resolved = getAnyFoodById(food.id) ?? food;
    if (id) {
      replaceRow(id, (row) => withFood(row, resolved, ctx));
    } else {
      manualIds.current += 1;
      const at = rows?.[0]?.timestamp ?? ctx.now;
      const row = manualRow(`m${manualIds.current}`, resolved, at, ctx);
      setRows((prev) => [...(prev ?? []), row]);
    }
    setView({ kind: 'list' });
  }

  // Writes the AI numbers of these rows (new "Món của tôi" / updated foods)
  // and returns the rows now pointing at the saved foods.
  async function saveAiFoods(target: MealDraftRow[]): Promise<Map<string, MealDraftRow>> {
    const ctx = context();
    const saved = new Map<string, MealDraftRow>();
    for (const step of aiSavePlan(target, newCustomFoodId)) {
      const food = step.food.nameVi.trim()
        ? step.food
        : { ...step.food, nameVi: t('components.textMealEntry.ai.unnamed') };
      if (step.kind === 'add') await addCustomFoodAndRegister(food);
      else await upsertOverrideAndRegister(food);
      const live = getAnyFoodById(food.id) ?? food;
      for (const row of target) {
        if (step.rowIds.includes(row.id)) saved.set(row.id, withSavedFood(row, live, ctx));
      }
    }
    return saved;
  }

  // "💾 Lưu n món": save the foods without logging anything.
  async function saveOnly() {
    if (!rows || saving) return;
    setSaving(true);
    try {
      const saved = await saveAiFoods(rows);
      setRows((prev) => prev && prev.map((row) => saved.get(row.id) ?? row));
      haptics.success();
    } finally {
      setSaving(false);
    }
  }

  async function commit() {
    if (!rows || saving) return;
    const chosen = rows.filter((row) => row.selected && !isBlocked(row));
    const workouts = activityLogPlan(activityRows, activityContext());
    if (chosen.length === 0 && workouts.length === 0) return;
    setSaving(true);
    const todayNow = todayString();
    try {
      const saved = await saveAiFoods(chosen);
      for (const picked of chosen) {
        const row = saved.get(picked.id) ?? picked;
        if (!row.food) continue;
        const item = getAnyFoodById(row.food.id) ?? row.food;
        // USDA rows have no Vietnamese name — logFood snapshots nameVi.
        const food = item.nameVi ? item : { ...item, nameVi: item.nameEn };
        const portion = row.count != null ? { portionUnit: item.portionUnit, count: row.count } : undefined;
        if (dateString(new Date(row.timestamp)) === todayNow) {
          await logFood(food, row.grams, row.timestamp, portion);
        } else {
          await logFoodForPastDate(food, row.grams, row.timestamp, portion);
        }
      }
      for (const step of workouts) {
        const activity = { steps: step.steps, workouts: step.workouts, startAt: step.startAt, endAt: step.endAt };
        if (step.today) await logActivity(activity);
        else await logActivityForPastDate(activity, step.timestamp);
      }
    } catch {
      // Whatever was logged stays; unlock so the sheet isn't stuck.
      setSaving(false);
      return;
    }
    useMealTextDraftStore.getState().clear();
    useChargeEffectStore.getState().triggerChargePulse();
    haptics.success();
    onLogged();
  }

  function cancel() {
    useMealTextDraftStore.getState().clear();
    onClose();
  }

  // ── Labels ─────────────────────────────────────────────────────────────

  function timeLabel(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString(LOCALE_TAGS[language], { hour: '2-digit', minute: '2-digit' });
  }

  function dayLabel(offset: number): string {
    if (offset === 0) return t('common.today');
    if (offset === -1) return t('common.yesterday');
    return new Date(atLocalTime(addDaysToDateString(today, offset), 12, 0)).toLocaleDateString(
      LOCALE_TAGS[language],
      { day: '2-digit', month: '2-digit' }
    );
  }

  function whenLabel(timestamp: number): string {
    const offset = dayOffsetOf(timestamp, today);
    return offset === 0 ? timeLabel(timestamp) : `${timeLabel(timestamp)} · ${dayLabel(offset)}`;
  }

  function rowName(row: MealDraftRow): string {
    if (!row.food) return t('components.textMealEntry.unknownFood', { text: row.decoded.raw });
    return foodDisplayName(row.food, language) || t('components.textMealEntry.ai.unnamed');
  }

  function amountLabel(row: MealDraftRow, food: FoodItem): string {
    return row.count != null
      ? formatPortionCount(row.count, food.portionUnit, food.servingLabel, language)
      : formatMeasure(Math.round(row.grams), measureUnitOf(food));
  }

  function mealLabelFor(timestamp: number | null): string {
    return timestamp == null ? '–' : mealLabel(mealTypeForTimestamp(timestamp, mealWindows), language);
  }

  function noteFor(row: MealDraftRow, issue: MealDraftIssue): string {
    const key = `components.textMealEntry.notes.${issue}`;
    switch (issue) {
      case 'duplicate': {
        const dup = row.duplicate;
        if (!dup) return '';
        return t(key, {
          name: foodLogEntryDisplayName(dup, language),
          amount: formatLoggedPortion(dup, getAnyFoodById(dup.foodId), language),
          when: whenLabel(dup.timestamp),
        });
      }
      case 'fuzzyMatch':
        return t(key, { text: row.decoded.foodQuery || row.decoded.raw });
      case 'unitGuess':
        return t(key, { unit: row.decoded.unit?.word ?? '' });
      case 'tooOld':
        return t(key, { days: BACKFILL_MAX_DAYS_BACK });
      case 'aiCompare': {
        const ai = Math.round(row.ai?.stated.energyKcal ?? 0);
        if (row.ai?.choice === 'ai') return t('components.textMealEntry.notes.aiCompareAi', { ai });
        return t('components.textMealEntry.notes.aiCompare', {
          ai,
          app: Math.round(row.ai?.base?.per100g.energyKcal ?? 0),
        });
      }
      case 'aiNew':
        return t('components.textMealEntry.notes.aiNew', { kcal: Math.round(row.food?.per100g.energyKcal ?? 0) });
      default:
        return t(key);
    }
  }

  // The duplicate (always — the user asked to see what it collides with)
  // plus the most important other note; one line each.
  function notesFor(row: MealDraftRow): string[] {
    const notes: string[] = [];
    if (row.duplicate) notes.push(noteFor(row, 'duplicate'));
    const other = row.issues.find((issue) => issue !== 'duplicate');
    if (other) notes.push(noteFor(row, other));
    return notes;
  }

  function status(row: MealDraftRow): { glyph: string; color: string } {
    if (isBlocked(row)) return { glyph: '✗', color: c.statusLow };
    if (row.issues.some((issue) => !INFO_ISSUES.has(issue))) return { glyph: '⚠', color: c.statusMid };
    return { glyph: '✓', color: c.statusGood };
  }

  // ── Workout labels ─────────────────────────────────────────────────────

  function matchName(match: ActivityMatch): string {
    switch (match.kind) {
      case 'type':
        return activityLabel(match.type, language);
      case 'lift':
        return activityLabel(match.exercise, language);
      case 'bodybuilding': {
        const custom = customExercises.find((e) => e.id === match.exerciseId);
        return custom ? custom.nameVi : t(`bbExercises.${match.exerciseId}`);
      }
      case 'custom':
        return customActivities.find((a) => a.id === match.id)?.nameVi ?? t('activities.custom');
    }
  }

  function activityName(row: ActivityDraftRow): string {
    if (row.match) return matchName(row.match);
    if (rowSteps(row) > 0) return t('components.textMealEntry.activity.steps');
    return t('components.textMealEntry.activity.unknown', { text: row.decoded.name || row.decoded.raw });
  }

  function activityAmount(row: ActivityDraftRow): string {
    const steps = rowSteps(row);
    if (steps > 0) {
      return t('components.textMealEntry.activity.stepsAmount', { steps: steps.toLocaleString(LOCALE_TAGS[language]) });
    }
    if (isSetBased(row.match)) {
      return row.sets ? formatSetSequence(row.sets, resolveTrainingLogFormat(trainingLogFormat), language) : '–';
    }
    return row.minutes != null ? t('components.textMealEntry.activity.minutesAmount', { minutes: row.minutes }) : '–';
  }

  function activityWhen(row: ActivityDraftRow): string {
    if (row.startAt != null) return whenLabel(row.startAt);
    return dayLabel(dayOffsetOf(atLocalTime(row.day, 12, 0), today));
  }

  function activityNote(row: ActivityDraftRow, issue: ActivityDraftIssue): string {
    const key = `components.textMealEntry.activity.notes.${issue}`;
    if (issue === 'duplicate') {
      const dup = row.duplicate;
      if (!dup) return '';
      const name = dup.workouts[0] ? workoutLabel(dup.workouts[0], language) : t('components.textMealEntry.activity.steps');
      return t(key, { name, when: whenLabel(dup.startAt ?? dup.timestamp) });
    }
    if (issue === 'tooOld') return t(key, { days: BACKFILL_MAX_DAYS_BACK });
    return t(key);
  }

  function activityNotes(row: ActivityDraftRow): string[] {
    const notes: string[] = [];
    if (row.duplicate) notes.push(activityNote(row, 'duplicate'));
    const other = row.issues.find((issue) => issue !== 'duplicate');
    if (other) notes.push(activityNote(row, other));
    return notes;
  }

  function activityStatus(row: ActivityDraftRow): { glyph: string; color: string } {
    if (isActivityBlocked(row)) return { glyph: '✗', color: c.statusLow };
    if (row.issues.some((issue) => !ACTIVITY_INFO_ISSUES.has(issue))) return { glyph: '⚠', color: c.statusMid };
    return { glyph: '✓', color: c.statusGood };
  }

  // Every activity the editor offers: the 🔥 Xả groups, the user's own, the
  // three lifts, and the row's own exercise when it is one.
  function activityChoices(row: ActivityDraftRow): { key: string; match: ActivityMatch }[] {
    const out: { key: string; match: ActivityMatch }[] = [];
    if (row.match?.kind === 'bodybuilding') out.push({ key: `bb:${row.match.exerciseId}`, match: row.match });
    for (const cat of ACTIVITY_CATEGORIES) {
      for (const type of cat.types) out.push({ key: type, match: { kind: 'type', type } });
    }
    for (const a of customActivities) out.push({ key: `custom:${a.id}`, match: { kind: 'custom', id: a.id } });
    for (const exercise of LIFTING_EXERCISES) out.push({ key: `lift:${exercise}`, match: { kind: 'lift', exercise } });
    return out;
  }

  const totals = rows ? draftTotals(rows) : { count: 0, kcal: 0 };
  const activityTotals = activityDraftTotals(activityRows, kcalContext);
  const commitLabel =
    totals.count > 0 && activityTotals.count > 0
      ? t('components.textMealEntry.commitBoth', { food: totals.count, activity: activityTotals.count })
      : activityTotals.count > 0
        ? t('components.textMealEntry.commitActivities', { count: activityTotals.count })
        : t('components.textMealEntry.commitButton', { count: totals.count });
  const pendingSaves = rows ? aiSavePlan(rows, () => '').length : 0;
  const sameTime = rows && rows.length > 0 && rows.every((row) => row.timestamp === rows[0].timestamp);
  const batchWhen = rows && rows.length > 0
    ? sameTime
      ? `${dayLabel(dayOffsetOf(rows[0].timestamp, today))} ${timeLabel(rows[0].timestamp)}`
      : t('components.textMealEntry.timeMixed')
    : '';

  // ── Sub-views ─────────────────────────────────────────────────────────

  const dayChips = (
    <View style={styles.dayChips}>
      {Array.from({ length: BACKFILL_MAX_DAYS_BACK + 1 }, (_, i) => -BACKFILL_MAX_DAYS_BACK + i).map((offset) => (
        <Pressable
          key={offset}
          onPress={() => setEditDay(offset)}
          style={({ pressed }) => [styles.dayChip, editDay === offset && styles.dayChipOn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ selected: editDay === offset }}
        >
          <Text style={[styles.dayChipText, editDay === offset && styles.dayChipTextOn]} numberOfLines={1}>
            {dayLabel(offset)}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const timeInputs = (label: string) => (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.timeRow}>
        <TextInput
          style={[styles.input, styles.timeInput]}
          placeholder="HH"
          placeholderTextColor={c.textMuted}
          keyboardType="number-pad"
          maxLength={2}
          value={editHour}
          onChangeText={setEditHour}
        />
        <Text style={styles.timeColon}>:</Text>
        <TextInput
          style={[styles.input, styles.timeInput]}
          placeholder="MM"
          placeholderTextColor={c.textMuted}
          keyboardType="number-pad"
          maxLength={2}
          value={editMinute}
          onChangeText={setEditMinute}
        />
      </View>
      <Text style={styles.fieldLabel}>{t('components.foodLogModal.logDateFieldLabel')}</Text>
      {dayChips}
    </>
  );

  const footer = (left: () => void, right: () => void, rightLabel: string, disabled = false) => (
    <View style={styles.footer}>
      <Pressable style={({ pressed }) => [styles.btn, styles.btnCancel, pressed && styles.pressed]} onPress={left}>
        <Text style={styles.btnCancelText}>{t('common.cancel')}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.btn, styles.btnMain, disabled && styles.disabled, pressed && styles.pressed]}
        onPress={right}
        disabled={disabled}
      >
        <Text style={styles.btnMainText} numberOfLines={1} adjustsFontSizeToFit>
          {rightLabel}
        </Text>
      </Pressable>
    </View>
  );

  const backToList = () => setView({ kind: 'list' });

  if (view.kind === 'pick') {
    const found = searchForMealText(pickQuery, preferIds, pickLibrary);
    const results = [...found.matches, ...found.similar].slice(0, PICK_LIMIT);
    return (
      <>
        <Text style={styles.title}>{t('components.textMealEntry.pickTitle')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('components.foodLogModal.searchPlaceholder')}
          placeholderTextColor={c.textMuted}
          value={pickQuery}
          onChangeText={setPickQuery}
          autoFocus
        />
        <FlatList
          style={styles.pickList}
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.empty}>{t('components.foodLogModal.emptyResults')}</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.pickRow, pressed && styles.pressed]}
              onPress={() => pick(item, view.id)}
            >
              <Text style={styles.pickName} numberOfLines={1}>
                {foodDisplayName(item, language)}
              </Text>
              <Text style={styles.pickMeta}>
                {t('components.foodLogModal.resultEnergyMeta', {
                  kcal: item.per100g.energyKcal,
                  measure: measureUnitOf(item),
                })}
              </Text>
            </Pressable>
          )}
        />
        <Pressable style={({ pressed }) => [styles.btn, styles.btnCancel, pressed && styles.pressed]} onPress={backToList}>
          <Text style={styles.btnCancelText}>{t('common.cancel')}</Text>
        </Pressable>
      </>
    );
  }

  if (view.kind === 'batchTime') {
    return (
      <>
        <Text style={styles.title}>{t('components.textMealEntry.batchTimeTitle')}</Text>
        {timeInputs(t('components.foodLogModal.mealTimeFieldLabel', { meal: mealLabelFor(editedTimestamp()) }))}
        {footer(backToList, applyBatchTime, t('components.textMealEntry.applyAll'), editedTimestamp() == null)}
      </>
    );
  }

  const editingActivity =
    view.kind === 'activityEdit' ? activityRows.find((row) => row.id === view.id) : undefined;
  if (view.kind === 'activityEdit' && editingActivity) {
    const setBased = isSetBased(editMatch);
    const setsBad = setBased && editSets.trim() !== '' && !parseSetNotation(editSets).ok;
    return (
      <>
        <Text style={styles.title} numberOfLines={2}>
          {editMatch ? matchName(editMatch) : activityName(editingActivity)}
        </Text>
        <ScrollView style={styles.editScroll} contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>{t('components.textMealEntry.activity.activityLabel')}</Text>
          <ScrollView style={styles.choiceWindow} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            <View style={styles.dayChips}>
              {activityChoices(editingActivity).map(({ key, match }) => {
                const on = sameMatch(match, editMatch);
                return (
                  <Pressable
                    key={key}
                    onPress={() => setEditMatch(match)}
                    style={({ pressed }) => [styles.dayChip, on && styles.dayChipOn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.dayChipText, on && styles.dayChipTextOn]} numberOfLines={1}>
                      {matchName(match)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          {setBased ? (
            <>
              <Text style={styles.fieldLabel}>{t('components.textMealEntry.activity.setsLabel')}</Text>
              <TextInput
                style={styles.input}
                value={editSets}
                onChangeText={setEditSets}
                placeholder="5x5x100"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {setsBad && <Text style={styles.pasteNote}>{t('components.textMealEntry.activity.setsInvalid')}</Text>}
            </>
          ) : (
            <View style={styles.pairRow}>
              <View style={styles.pairCol}>
                <Text style={styles.fieldLabel}>{t('components.textMealEntry.activity.minutesLabel')}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  value={editMinutes}
                  onChangeText={setEditMinutes}
                />
              </View>
              <View style={styles.pairCol}>
                <Text style={styles.fieldLabel}>{t('components.textMealEntry.activity.stepsLabel')}</Text>
                <TextInput style={styles.input} keyboardType="number-pad" value={editSteps} onChangeText={setEditSteps} />
              </View>
            </View>
          )}
          {timeInputs(t('components.textMealEntry.activity.startLabel'))}
          <View style={styles.editActions}>
            <Pressable
              style={({ pressed }) => [styles.editAction, styles.editActionDanger, pressed && styles.pressed]}
              onPress={() => {
                replaceActivityRow(editingActivity.id, () => null);
                backToList();
              }}
            >
              <Text style={styles.editActionDangerText}>{t('components.textMealEntry.removeRow')}</Text>
            </Pressable>
          </View>
        </ScrollView>
        {footer(backToList, () => saveActivityEdit(editingActivity.id), t('components.textMealEntry.done'))}
      </>
    );
  }

  const aiLabels: Record<AiLabel, string> = {
    kcal: t('components.textMealEntry.ai.kcal'),
    protein: t('components.textMealEntry.ai.protein'),
    carbs: t('components.textMealEntry.ai.carbs'),
    fat: t('components.textMealEntry.ai.fat'),
    fiber: t('components.textMealEntry.ai.fiber'),
    sugar: t('components.textMealEntry.ai.sugar'),
    sodium: t('components.textMealEntry.ai.sodium'),
  };
  const choiceLabels: Record<AiChoice, string> = {
    app: t('components.textMealEntry.ai.choiceApp'),
    ai: t('components.textMealEntry.ai.choiceAi'),
    new: t('components.textMealEntry.ai.choiceNew'),
  };
  const nutrientValue = (value: number | undefined) =>
    value == null ? '–' : value.toLocaleString(LOCALE_TAGS[language], { maximumFractionDigits: 1 });

  const editing = view.kind === 'edit' ? rows?.find((row) => row.id === view.id) : undefined;
  if (view.kind === 'edit' && editing?.food) {
    const food = editing.food;
    const counted = editing.count != null;
    const ai = editing.ai;
    const base = ai?.base ?? null;
    const choice = editChoice ?? ai?.choice ?? 'app';
    const choices = AI_CHOICES.filter((option) => option === 'new' || base != null);
    const aiHint =
      choice === 'app'
        ? t('components.textMealEntry.ai.hintApp')
        : choice === 'ai'
          ? t('components.textMealEntry.ai.hintAi', { name: base ? foodDisplayName(base, language) : '' })
          : t('components.textMealEntry.ai.hintNew');
    return (
      <>
        <Text style={styles.title} numberOfLines={2}>
          {rowName(editing)}
        </Text>
        <ScrollView style={styles.editScroll} contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>
            {counted
              ? t('components.foodLogModal.portionCountLabel', {
                  unit: portionUnitNoun(food.portionUnit, food.servingLabel, language),
                })
              : t('components.foodLogModal.gramsFieldLabel', { measure: measureUnitOf(food) })}
          </Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={editAmount}
            onChangeText={setEditAmount}
          />
          {!counted && food.servingPresets.length > 0 && (
            <View style={styles.dayChips}>
              {food.servingPresets.map((p) => (
                <Pressable
                  key={p.label}
                  style={({ pressed }) => [styles.dayChip, pressed && styles.pressed]}
                  onPress={() => setEditAmount(String(p.grams))}
                >
                  <Text style={styles.dayChipText}>
                    {p.label}={p.grams}g
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {ai && (
            <>
              {choice === 'new' && (
                <>
                  <Text style={styles.fieldLabel}>{t('components.textMealEntry.ai.nameLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder={t('components.textMealEntry.ai.unnamed')}
                    placeholderTextColor={c.textMuted}
                  />
                </>
              )}
              <View style={styles.aiTable}>
                <View style={styles.aiRow}>
                  <Text style={[styles.aiLabel, styles.aiHead]} numberOfLines={1}>
                    {t('components.textMealEntry.ai.title', { measure: measureUnitOf(food) })}
                  </Text>
                  {base && <Text style={[styles.aiValue, styles.aiHead]}>{t('components.textMealEntry.ai.colApp')}</Text>}
                  <Text style={[styles.aiValue, styles.aiHead]}>{t('components.textMealEntry.ai.colAi')}</Text>
                </View>
                {AI_TABLE.filter((r) => r.always || ai.stated[r.key] != null).map((r) => (
                  <View key={r.key} style={styles.aiRow}>
                    <Text style={styles.aiLabel} numberOfLines={1}>
                      {aiLabels[r.label]}
                    </Text>
                    {base && <Text style={styles.aiValue}>{nutrientValue(base.per100g[r.key])}</Text>}
                    <Text style={[styles.aiValue, styles.aiValueAi]}>{nutrientValue(ai.stated[r.key])}</Text>
                  </View>
                ))}
              </View>
              {choices.length > 1 && (
                <View style={styles.aiChoices}>
                  {choices.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => setEditChoice(option)}
                      style={({ pressed }) => [styles.aiChoice, choice === option && styles.aiChoiceOn, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: choice === option }}
                    >
                      <Text
                        style={[styles.aiChoiceText, choice === option && styles.aiChoiceTextOn]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {choiceLabels[option]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Text style={styles.aiHint}>{aiHint}</Text>
            </>
          )}
          {timeInputs(t('components.foodLogModal.mealTimeFieldLabel', { meal: mealLabelFor(editedTimestamp()) }))}
          <View style={styles.editActions}>
            <Pressable
              style={({ pressed }) => [styles.editAction, pressed && styles.pressed]}
              onPress={() => {
                setPickQuery(editing.decoded.foodQuery || foodDisplayName(food, language));
                setView({ kind: 'pick', id: editing.id });
              }}
            >
              <Text style={styles.editActionText}>{t('components.textMealEntry.changeFood')}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.editAction, styles.editActionDanger, pressed && styles.pressed]}
              onPress={() => {
                replaceRow(editing.id, () => null);
                backToList();
              }}
            >
              <Text style={styles.editActionDangerText}>{t('components.textMealEntry.removeRow')}</Text>
            </Pressable>
          </View>
        </ScrollView>
        {footer(backToList, () => saveEdit(editing.id), t('components.textMealEntry.done'))}
      </>
    );
  }

  // ── The list ──────────────────────────────────────────────────────────

  return (
    <>
      <View style={styles.headerRow}>
        <Pressable onPress={onBack} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.back}>{t('components.foodLogModal.backToSearch')}</Text>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
          <Text style={styles.closeX}>✕</Text>
        </Pressable>
      </View>
      <View style={styles.titleRow}>
        <Text style={styles.title}>
          {t(variant === 'day' ? 'components.textMealEntry.titleDay' : 'components.textMealEntry.title')}
        </Text>
        <Pressable
          onPress={() => setShowHint((v) => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('components.textMealEntry.infoA11y')}
          accessibilityState={{ expanded: showHint }}
        >
          <Text style={[styles.info, showHint && styles.infoOn]}>ⓘ</Text>
        </Pressable>
      </View>
      {showHint && <Text style={styles.hint}>{t('components.textMealEntry.hint')}</Text>}
      <TextInput
        style={[styles.input, styles.textBox]}
        placeholder={t(variant === 'day' ? 'components.textMealEntry.placeholderDay' : 'components.textMealEntry.placeholder')}
        placeholderTextColor={c.textMuted}
        value={text}
        onChangeText={updateText}
        multiline
        autoFocus={rows == null}
        textAlignVertical="top"
      />
      <View style={styles.inputActions}>
        <Pressable style={({ pressed }) => [styles.sideBtn, pressed && styles.pressed]} onPress={askAi}>
          <Text style={styles.sideText} numberOfLines={1} adjustsFontSizeToFit>
            {t('components.textMealEntry.askAiButton')}
          </Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.sideBtn, pressed && styles.pressed]} onPress={paste}>
          <Text style={styles.sideText} numberOfLines={1} adjustsFontSizeToFit>
            {t('components.textMealEntry.pasteButton')}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.analyzeBtn,
            (!text.trim() || analyzing) && styles.disabled,
            pressed && styles.pressed,
          ]}
          onPress={() => analyze()}
          disabled={!text.trim() || analyzing}
        >
          <Text style={styles.analyzeText} numberOfLines={1} adjustsFontSizeToFit>
            {t('components.textMealEntry.analyzeButton')}
          </Text>
        </Pressable>
      </View>
      {pasteEmpty && <Text style={styles.pasteNote}>{t('components.textMealEntry.pasteEmpty')}</Text>}

      {rows && rows.length === 0 && activityRows.length === 0 && (
        <Text style={styles.empty}>{t('components.textMealEntry.nothingFound')}</Text>
      )}

      {rows && (rows.length > 0 || activityRows.length > 0) && (
        <>
          {rows.length > 0 && (
            <View style={styles.summaryRow}>
              <Pressable onPress={openBatchTime} style={({ pressed }) => pressed && styles.pressed} accessibilityRole="button">
                <Text style={styles.timeChip} numberOfLines={1}>
                  {t('components.textMealEntry.timeChip', { when: batchWhen })}
                </Text>
              </Pressable>
              <Text style={styles.summary} numberOfLines={1}>
                {t('components.textMealEntry.summary', {
                  count: totals.count,
                  kcal: totals.kcal.toLocaleString(LOCALE_TAGS[language]),
                })}
              </Text>
            </View>
          )}
          <ScrollView style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {rows.map((row) => {
              const blocked = isBlocked(row);
              const { glyph, color } = status(row);
              const name = rowName(row);
              const food = row.food;
              return (
                <View key={row.id} style={styles.row}>
                  <View style={styles.rowTop}>
                    <Pressable
                      onPress={() => replaceRow(row.id, toggleRow)}
                      disabled={blocked}
                      hitSlop={8}
                      accessibilityRole="checkbox"
                      accessibilityLabel={t('components.textMealEntry.rowCheckboxA11y', { name })}
                      accessibilityState={{ checked: row.selected, disabled: blocked }}
                    >
                      <Text style={[styles.check, row.selected && styles.checkOn, blocked && styles.checkBlocked]}>
                        {row.selected ? '☑' : '☐'}
                      </Text>
                    </Pressable>
                    <Text style={[styles.statusGlyph, { color }]}>{glyph}</Text>
                    <Text style={[styles.rowName, !food && styles.rowNameUnknown]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Pressable
                      onPress={() => openEdit(row)}
                      hitSlop={8}
                      style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={t('components.textMealEntry.editRowA11y', { name })}
                    >
                      <Text style={styles.editGlyph}>✎</Text>
                    </Pressable>
                  </View>
                  {food && (
                    <View style={styles.rowBottom}>
                      <Text style={styles.rowTime} numberOfLines={1}>
                        {whenLabel(row.timestamp)} · {mealLabelFor(row.timestamp)}
                      </Text>
                      <View style={styles.stepper}>
                        <Pressable
                          onPress={() => replaceRow(row.id, (r) => stepAmount(r, -1, context()))}
                          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                          accessibilityRole="button"
                          accessibilityLabel={t('components.textMealEntry.stepDownA11y')}
                        >
                          <Text style={styles.stepText}>−</Text>
                        </Pressable>
                        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
                          {amountLabel(row, food)}
                        </Text>
                        <Pressable
                          onPress={() => replaceRow(row.id, (r) => stepAmount(r, 1, context()))}
                          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                          accessibilityRole="button"
                          accessibilityLabel={t('components.textMealEntry.stepUpA11y')}
                        >
                          <Text style={styles.stepText}>+</Text>
                        </Pressable>
                      </View>
                      <Text style={styles.kcal}>{rowKcal(row)}</Text>
                    </View>
                  )}
                  {notesFor(row).map((note, i) => (
                    <Text
                      key={i}
                      style={[styles.note, { color: i === 0 && (row.duplicate || blocked) ? color : c.textTertiary }]}
                      numberOfLines={2}
                    >
                      {note}
                    </Text>
                  ))}
                </View>
              );
            })}
            <View style={styles.listActions}>
              <Pressable
                style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
                onPress={() => {
                  setPickQuery('');
                  setView({ kind: 'pick', id: null });
                }}
              >
                <Text style={styles.addRowText} numberOfLines={1} adjustsFontSizeToFit>
                  {t('components.textMealEntry.addRow')}
                </Text>
              </Pressable>
              {pendingSaves > 0 && (
                <Pressable
                  style={({ pressed }) => [styles.addRow, (saving && styles.disabled) || null, pressed && styles.pressed]}
                  onPress={saveOnly}
                  disabled={saving}
                >
                  <Text style={styles.addRowText} numberOfLines={1} adjustsFontSizeToFit>
                    {t('components.textMealEntry.ai.saveButton', { count: pendingSaves })}
                  </Text>
                </Pressable>
              )}
            </View>
            {activityRows.length > 0 && (
              <Text style={styles.sectionHead} numberOfLines={1}>
                {t('components.textMealEntry.activity.section', {
                  count: activityTotals.count,
                  kcal: activityTotals.kcal.toLocaleString(LOCALE_TAGS[language]),
                })}
              </Text>
            )}
            {activityRows.map((row) => {
              const blocked = isActivityBlocked(row);
              const { glyph, color } = activityStatus(row);
              const name = activityName(row);
              const steppable = !isSetBased(row.match) && (row.match != null || rowSteps(row) > 0);
              return (
                <View key={row.id} style={styles.row}>
                  <View style={styles.rowTop}>
                    <Pressable
                      onPress={() => replaceActivityRow(row.id, toggleActivityRow)}
                      disabled={blocked}
                      hitSlop={8}
                      accessibilityRole="checkbox"
                      accessibilityLabel={t('components.textMealEntry.activity.rowCheckboxA11y', { name })}
                      accessibilityState={{ checked: row.selected, disabled: blocked }}
                    >
                      <Text style={[styles.check, row.selected && styles.checkOn, blocked && styles.checkBlocked]}>
                        {row.selected ? '☑' : '☐'}
                      </Text>
                    </Pressable>
                    <Text style={[styles.statusGlyph, { color }]}>{glyph}</Text>
                    <Text style={[styles.rowName, !row.match && rowSteps(row) === 0 && styles.rowNameUnknown]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Pressable
                      onPress={() => openActivityEdit(row)}
                      hitSlop={8}
                      style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={t('components.textMealEntry.editRowA11y', { name })}
                    >
                      <Text style={styles.editGlyph}>✎</Text>
                    </Pressable>
                  </View>
                  {(row.match || rowSteps(row) > 0) && (
                    <View style={styles.rowBottom}>
                      <Text style={styles.rowTime} numberOfLines={1}>
                        {activityWhen(row)}
                      </Text>
                      {steppable ? (
                        <View style={styles.stepper}>
                          <Pressable
                            onPress={() => stepActivity(row, -1)}
                            style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                            accessibilityRole="button"
                            accessibilityLabel={t('components.textMealEntry.activity.stepDownA11y')}
                          >
                            <Text style={styles.stepText}>−</Text>
                          </Pressable>
                          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
                            {activityAmount(row)}
                          </Text>
                          <Pressable
                            onPress={() => stepActivity(row, 1)}
                            style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                            accessibilityRole="button"
                            accessibilityLabel={t('components.textMealEntry.activity.stepUpA11y')}
                          >
                            <Text style={styles.stepText}>+</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <Text style={styles.setsText} numberOfLines={1} adjustsFontSizeToFit>
                          {activityAmount(row)}
                        </Text>
                      )}
                      <Text style={styles.kcal}>{rowActivityKcal(row, kcalContext)}</Text>
                    </View>
                  )}
                  {activityNotes(row).map((note, i) => (
                    <Text
                      key={i}
                      style={[styles.note, { color: i === 0 && (row.duplicate || blocked) ? color : c.textTertiary }]}
                      numberOfLines={2}
                    >
                      {note}
                    </Text>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        </>
      )}

      {footer(cancel, commit, commitLabel, (totals.count === 0 && activityTotals.count === 0) || saving)}
    </>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    back: { color: c.mint, fontSize: 14, fontWeight: '600' },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeX: { color: c.textSecondary, fontSize: 15, fontWeight: '700' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
    info: { color: c.textTertiary, fontSize: 18 },
    infoOn: { color: c.accent },
    hint: { color: c.textSecondary, fontSize: 12, lineHeight: 18 },
    input: {
      backgroundColor: c.bgElevated,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.border,
    },
    textBox: { minHeight: 64, maxHeight: 110 },
    inputActions: { flexDirection: 'row', gap: 8 },
    sideBtn: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgElevated,
    },
    sideText: { color: c.textPrimary, fontSize: 14, fontWeight: '600' },
    analyzeBtn: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.accent,
      backgroundColor: c.bgElevated,
    },
    analyzeText: { color: c.accent, fontSize: 14, fontWeight: '700' },
    pasteNote: { color: c.statusMid, fontSize: 12 },
    empty: { color: c.textTertiary, textAlign: 'center', paddingVertical: 12 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    timeChip: { color: c.info, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
    summary: { color: c.textSecondary, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'], flexShrink: 1 },
    list: { maxHeight: LIST_HEIGHT, flexShrink: 1 },
    row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.divider, gap: 4 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    check: { color: c.textTertiary, fontSize: 20, width: 22, textAlign: 'center' },
    checkOn: { color: c.accent },
    checkBlocked: { opacity: 0.35 },
    statusGlyph: { fontSize: 14, fontWeight: '800', width: 14, textAlign: 'center' },
    rowName: { flex: 1, color: c.textPrimary, fontSize: 15, fontWeight: '600' },
    rowNameUnknown: { color: c.textTertiary, fontStyle: 'italic' },
    editBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editGlyph: { color: c.textSecondary, fontSize: 14 },
    rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 52 },
    rowTime: { flex: 1, color: c.textTertiary, fontSize: 12, fontVariant: ['tabular-nums'] },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stepBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepText: { color: c.textPrimary, fontSize: 16, fontWeight: '700' },
    amount: {
      width: 64,
      textAlign: 'center',
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    kcal: { width: 40, textAlign: 'right', color: c.textTertiary, fontSize: 12, fontVariant: ['tabular-nums'] },
    note: { fontSize: 11, lineHeight: 15, paddingLeft: 52 },
    listActions: { flexDirection: 'row', gap: 8 },
    addRow: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    addRowText: { color: c.mint, fontSize: 14, fontWeight: '700' },
    footer: { flexDirection: 'row', gap: 12, marginTop: 4 },
    btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
    btnCancel: { backgroundColor: c.bgElevated },
    btnCancelText: { color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    btnMain: { backgroundColor: c.accent },
    btnMainText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.4 },
    pressed: { opacity: 0.6 },
    fieldLabel: { fontSize: 13, color: c.textSecondary, marginTop: 4 },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    timeInput: { width: 70, textAlign: 'center' },
    timeColon: { color: c.textPrimary, fontSize: 20, fontWeight: '700' },
    dayChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    dayChip: {
      flexGrow: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      alignItems: 'center',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
    },
    dayChipOn: { borderColor: c.accent, backgroundColor: c.accent },
    dayChipText: { color: c.textLight, fontSize: 12, fontWeight: '600' },
    dayChipTextOn: { color: c.onAccent },
    editScroll: { flexShrink: 1 },
    editContent: { gap: 10 },
    editActions: { flexDirection: 'row', gap: 12, marginTop: 6 },
    editAction: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgElevated,
    },
    editActionText: { color: c.textPrimary, fontSize: 14, fontWeight: '600' },
    editActionDanger: { borderColor: c.dangerStrong },
    editActionDangerText: { color: c.dangerStrong, fontSize: 14, fontWeight: '600' },
    pickList: { maxHeight: LIST_HEIGHT, flexShrink: 1 },
    aiTable: { borderRadius: 10, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 6 },
    aiRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, gap: 8 },
    aiLabel: { flex: 1, color: c.textSecondary, fontSize: 13 },
    aiHead: { color: c.textTertiary, fontSize: 12, fontWeight: '700' },
    aiValue: { width: 56, textAlign: 'right', color: c.textPrimary, fontSize: 13, fontVariant: ['tabular-nums'] },
    aiValueAi: { color: c.accent, fontWeight: '700' },
    aiChoices: { flexDirection: 'row', gap: 8 },
    aiChoice: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgElevated,
    },
    aiChoiceOn: { borderColor: c.accent },
    aiChoiceText: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
    aiChoiceTextOn: { color: c.accent, fontWeight: '700' },
    aiHint: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
    pickRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.divider },
    sectionHead: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      paddingTop: 12,
      paddingBottom: 2,
    },
    setsText: {
      width: 120,
      textAlign: 'center',
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    choiceWindow: { maxHeight: 132, flexGrow: 0 },
    pairRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
    pairCol: { flex: 1, gap: 4 },
    pickName: { color: c.textPrimary, fontSize: 15, fontWeight: '600' },
    pickMeta: { color: c.textTertiary, fontSize: 12, marginTop: 2 },
  });
