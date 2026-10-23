import AsyncStorage from '@react-native-async-storage/async-storage';
import { previousMonthRange } from './monthRange';
import { exportDataInRangeToFile } from './excelExportService';
import { getFoodLogInRange } from '../../data/repositories/foodLogRepository';
import { getReadingsInRange } from '../../data/repositories/batteryRepository';
import { getCurrentLanguage } from '../../i18n/useT';

// Persisted marker: the "YYYY-MM" of the month during which we last ran the
// monthly export. Comparing it to the current month makes the export run at
// most once per calendar month. A tiny AsyncStorage key keeps this feature
// self-contained (no schema / settings-store changes).
const MARKER_KEY = 'monthly-export-marker';

export interface MonthlyExportResult {
  ran: boolean;
  filename?: string;
}

// On startup: if we haven't exported yet this calendar month AND the previous
// month has data, write that month's workbook to the app document directory
// and advance the marker. Fully defensive — never throws (must not crash the
// app bootstrap). It does NOT delete anything — trimming old data is the
// retention cycle's job (services/retention/retentionService.ts).
export async function maybeRunMonthlyExport(now: Date = new Date()): Promise<MonthlyExportResult> {
  try {
    const range = previousMonthRange(now);

    const marker = await AsyncStorage.getItem(MARKER_KEY);
    if (marker === range.marker) return { ran: false };

    // Only bother writing a file when the previous month actually has data.
    const [foodLog, readings] = await Promise.all([
      getFoodLogInRange(range.from, range.to),
      getReadingsInRange(range.from, range.to),
    ]);

    if (foodLog.length === 0 && readings.length === 0) {
      // Nothing to export — advance the marker so we don't re-check on every
      // launch this month, but don't produce an empty file.
      await AsyncStorage.setItem(MARKER_KEY, range.marker);
      return { ran: false };
    }

    await exportDataInRangeToFile(range.from, range.to, range.filename, getCurrentLanguage());
    await AsyncStorage.setItem(MARKER_KEY, range.marker);
    return { ran: true, filename: range.filename };
  } catch {
    // Swallow: a failed export must never block app startup.
    return { ran: false };
  }
}
