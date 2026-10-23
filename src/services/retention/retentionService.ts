import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {
  deleteTrimmableRows,
  getDatabaseSizeBytes,
  getOldestTrimmableDate,
  getTrimmableRows,
  restoreRows,
  upsertEatingSummaries,
} from '../../data/repositories/retentionRepository';
import { getFoodLogInRange } from '../../data/repositories/foodLogRepository';
import { getAnyFoodById } from '../../data/food/foodLookup';
import { exportDataInRangeToFile } from '../export/excelExportService';
import {
  cancelScheduledNotification,
  scheduleDateNotification,
} from '../notifications/notificationService';
import {
  computeRetentionSchedule,
  estimateStorage,
  manualCutoff,
  type ReminderKey,
  type StorageEstimate,
} from '../../domain/retention/retentionSchedule';
import { summarizeEatingDays } from '../../domain/retention/eatingHabits';
import {
  countBackupRows,
  parseDataBackup,
  serializeDataBackup,
  type RejectedDataBackup,
} from '../../domain/retention/dataBackup';
import { resolveDataRetention, type DataRetentionSettings } from '../../types/dataRetention';
import { useSettingsStore } from '../../store/settingsStore';
import { addDaysToDateString, daysBetween, formatDisplayDate, todayString } from '../../lib/dateUtils';
import { translate } from '../../i18n/translate';
import { getCurrentLanguage } from '../../i18n/useT';

// The retention cycle's side effects (rules: domain/retention/retentionSchedule.ts).
// Order is what keeps it safe: write the Excel + restorable backup, check both
// files, and only then ASK — nothing is deleted without the user's "Dọn", and
// nothing at all if a backup could not be written.

const STATE_KEY = 'data-retention-state';
const BACKUP_PREFIX = 'BodyBatteries_Backup_';
const REMINDER_KEYS: ReminderKey[] = ['3m', '1m', '1w'];
const REMINDER_HOUR = 9;
const SNOOZE_DAYS = 7;
const SNOOZE_AFTER_RESTORE_DAYS = 30;

export interface PendingTrim {
  cutoff: string; // rows before this day go
  fromDate: string;
  toDate: string;
  rowCount: number;
  excelUri: string;
  jsonUri: string;
}

interface RetentionState {
  pending?: PendingTrim;
  snoozedUntil?: string;
}

async function readState(): Promise<RetentionState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as RetentionState) : {};
  } catch {
    return {};
  }
}

async function writeState(state: RetentionState): Promise<void> {
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function currentSettings(): DataRetentionSettings {
  return resolveDataRetention(useSettingsStore.getState().dataRetention);
}

function fileLooksWritten(uri: string): boolean {
  try {
    const file = new File(uri);
    return file.exists && (file.size ?? 0) > 0;
  } catch {
    return false;
  }
}

// ─── Reminders (3 months / 1 month / 1 week before the trim date) ────────────

export async function syncRetentionReminders(today: string = todayString()): Promise<void> {
  try {
    for (const key of REMINDER_KEYS) await cancelScheduledNotification(`retention-${key}`);
    const settings = currentSettings();
    if (!settings.setupDone) return;
    const schedule = computeRetentionSchedule(await getOldestTrimmableDate(settings.archive), settings, today);
    if (!schedule) return;
    const language = getCurrentLanguage();
    for (const reminder of schedule.reminders) {
      await scheduleDateNotification(
        `retention-${reminder.key}`,
        reminder.date,
        REMINDER_HOUR,
        translate(language, 'dataRetention.reminder.title'),
        translate(language, 'dataRetention.reminder.body', {
          left: translate(language, `dataRetention.reminder.left${reminder.key}`),
          date: formatDisplayDate(schedule.trimDate, language),
          cutoff: formatDisplayDate(schedule.cutoffDate, language),
        })
      );
    }
  } catch {
    // Reminders are a courtesy — a refused permission must not break anything.
  }
}

// ─── Backup → ask → trim ─────────────────────────────────────────────────────

// Writes both backup files for everything before `cutoff` (and, when the 🥗
// Kho is on, the daily eating summaries of those days first). null = nothing
// to trim, or a file failed — in both cases nothing changes.
async function prepareTrim(cutoff: string, settings: DataRetentionSettings): Promise<PendingTrim | null> {
  const fromDate = await getOldestTrimmableDate(settings.archive);
  if (fromDate == null || fromDate >= cutoff) return null;
  const toDate = addDaysToDateString(cutoff, -1);

  if (settings.archive.eatingHabits) {
    const foods = await getFoodLogInRange(fromDate, toDate);
    await upsertEatingSummaries(summarizeEatingDays(foods, getAnyFoodById));
  }

  const tables = await getTrimmableRows(cutoff, settings.archive);
  const rowCount = countBackupRows({ tables });
  if (rowCount === 0) return null;
  const json = serializeDataBackup(tables, { fromDate, toDate }, Date.now());

  const stem = `${BACKUP_PREFIX}${fromDate.replace(/-/g, '')}_${toDate.replace(/-/g, '')}`;
  const jsonFile = new File(Paths.document, `${stem}.json`);
  jsonFile.create({ overwrite: true });
  jsonFile.write(json);
  const excelUri = await exportDataInRangeToFile(fromDate, toDate, `${stem}.xlsx`, getCurrentLanguage());

  if (!fileLooksWritten(jsonFile.uri) || !fileLooksWritten(excelUri)) return null;
  return { cutoff, fromDate, toDate, rowCount, excelUri, jsonUri: jsonFile.uri };
}

// On app start: when the trim date has come (and the user did not just say
// "Để sau"), make sure the backups exist and return what to ask about.
// Never throws — must not break the bootstrap.
export async function checkRetentionDue(today: string = todayString()): Promise<PendingTrim | null> {
  try {
    const settings = currentSettings();
    if (!settings.setupDone) return null;
    await syncRetentionReminders(today);
    const schedule = computeRetentionSchedule(await getOldestTrimmableDate(settings.archive), settings, today);
    if (!schedule?.due) return null;

    const state = await readState();
    if (state.snoozedUntil && today < state.snoozedUntil) return null;
    const kept = state.pending;
    if (kept && kept.cutoff === schedule.cutoffDate && fileLooksWritten(kept.jsonUri) && fileLooksWritten(kept.excelUri)) {
      return kept;
    }
    const pending = await prepareTrim(schedule.cutoffDate, settings);
    await writeState({ ...state, pending: pending ?? undefined });
    return pending;
  } catch {
    return null;
  }
}

async function confirmTrim(pending: PendingTrim): Promise<void> {
  await deleteTrimmableRows(pending.cutoff, currentSettings().archive);
  await writeState({});
  await syncRetentionReminders();
}

async function snooze(days: number): Promise<void> {
  const state = await readState();
  await writeState({ ...state, snoozedUntil: addDaysToDateString(todayString(), days) });
}

export async function shareBackupFiles(pending: Pick<PendingTrim, 'jsonUri' | 'excelUri'>): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) return;
  const dialogTitle = translate(getCurrentLanguage(), 'dataRetention.shareDialogTitle');
  // One sheet per file: the restore file first (the one that matters if the
  // phone is lost), then the readable Excel copy.
  await Sharing.shareAsync(pending.jsonUri, { mimeType: 'application/json', dialogTitle });
  await Sharing.shareAsync(pending.excelUri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle,
  });
}

// Newest backup pair in the app's document folder (names sort by date range).
export function getLatestBackup(): Pick<PendingTrim, 'jsonUri' | 'excelUri'> | null {
  try {
    const files = Paths.document
      .list()
      .filter((entry): entry is File => entry instanceof File && entry.name.startsWith(BACKUP_PREFIX));
    const json = files.filter((f) => f.name.endsWith('.json')).sort((a, b) => b.name.localeCompare(a.name))[0];
    if (!json) return null;
    const excel = files.find((f) => f.name === json.name.replace(/\.json$/, '.xlsx'));
    return excel ? { jsonUri: json.uri, excelUri: excel.uri } : null;
  } catch {
    return null;
  }
}

// The one question before anything is deleted.
export function promptRetentionTrim(pending: PendingTrim): void {
  const language = getCurrentLanguage();
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
  Alert.alert(
    t('dataRetention.prompt.title'),
    t('dataRetention.prompt.message', {
      rows: pending.rowCount,
      from: formatDisplayDate(pending.fromDate, language),
      to: formatDisplayDate(pending.toDate, language),
      cutoff: formatDisplayDate(pending.cutoff, language),
    }),
    [
      {
        text: t('dataRetention.prompt.share'),
        onPress: () => {
          void shareBackupFiles(pending).then(() => promptRetentionTrim(pending));
        },
      },
      { text: t('dataRetention.prompt.later'), style: 'cancel', onPress: () => void snooze(SNOOZE_DAYS) },
      {
        text: t('dataRetention.prompt.trim'),
        style: 'destructive',
        onPress: () => {
          void confirmTrim(pending).then(
            () => Alert.alert(t('dataRetention.done.title'), t('dataRetention.done.message')),
            () => Alert.alert(t('dataRetention.failed.title'), t('dataRetention.failed.message'))
          );
        },
      },
    ]
  );
}

// Settings → "Sao lưu & dọn ngay": same backup + question, counted back from today.
export async function startManualTrim(): Promise<void> {
  const language = getCurrentLanguage();
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
  const settings = currentSettings();
  const cutoff = manualCutoff(settings, todayString());
  let pending: PendingTrim | null = null;
  try {
    pending = await prepareTrim(cutoff, settings);
  } catch {
    Alert.alert(t('dataRetention.failed.title'), t('dataRetention.failed.message'));
    return;
  }
  if (!pending) {
    Alert.alert(t('dataRetention.nothing.title'), t('dataRetention.nothing.message', { cutoff: formatDisplayDate(cutoff, language) }));
    return;
  }
  await writeState({ pending });
  promptRetentionTrim(pending);
}

// ─── Restore ─────────────────────────────────────────────────────────────────

export type RestoreOutcome =
  | { ok: true; added: number; fromDate: string; toDate: string }
  | RejectedDataBackup
  | { ok: false; reasonKey: 'canceled' };

// Pick a backup .json (Files, iCloud Drive, AirDrop…) and merge it back in —
// rows already present are left alone. The next trim question is pushed back
// a month so restored history is not offered for deletion right away.
export async function restoreFromPickedFile(): Promise<RestoreOutcome> {
  const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (picked.canceled || !picked.assets?.[0]) return { ok: false, reasonKey: 'canceled' };
  let text: string;
  try {
    text = await new File(picked.assets[0].uri).text();
  } catch {
    return { ok: false, reasonKey: 'unreadable' };
  }
  const parsed = parseDataBackup(text);
  if (!parsed.ok) return parsed;
  const added = await restoreRows(parsed.backup.tables);
  await snooze(SNOOZE_AFTER_RESTORE_DAYS);
  await syncRetentionReminders();
  return { ok: true, added, fromDate: parsed.backup.fromDate, toDate: parsed.backup.toDate };
}

// ─── Estimate for Settings ───────────────────────────────────────────────────

export interface RetentionOverview {
  estimate: StorageEstimate;
  nextTrimDate: string | null;
}

export async function loadRetentionOverview(settings: DataRetentionSettings): Promise<RetentionOverview> {
  const today = todayString();
  const [dbBytes, oldestAny, oldestTrimmable] = await Promise.all([
    getDatabaseSizeBytes(),
    getOldestTrimmableDate(null),
    getOldestTrimmableDate(settings.archive),
  ]);
  const daysWithData = oldestAny ? Math.round(daysBetween(oldestAny, today)) + 1 : 0;
  const schedule = computeRetentionSchedule(oldestTrimmable, settings, today);
  return {
    estimate: estimateStorage(dbBytes, daysWithData, settings.months),
    nextTrimDate: schedule?.trimDate ?? null,
  };
}
