import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { previousMonthRange } from './monthRange';
import { exportDataInRangeToFile } from './excelExportService';
import { getFoodLogInRange } from '../../data/repositories/foodLogRepository';
import { getReadingsInRange } from '../../data/repositories/batteryRepository';
import { runWeeklyCleanup } from '../cleanup/cleanupService';

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
// app bootstrap). It does NOT delete anything: deletion is only offered to the
// user afterwards via confirmAndCleanupAfterExport.
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

    await exportDataInRangeToFile(range.from, range.to, range.filename);
    await AsyncStorage.setItem(MARKER_KEY, range.marker);
    return { ran: true, filename: range.filename };
  } catch {
    // Swallow: a failed export must never block app startup.
    return { ran: false };
  }
}

// Ask the user (never silently) whether to delete data older than the retention
// window. Deletion runs ONLY on explicit confirmation. Call this after a
// successful monthly write so the just-saved Excel acts as the backup.
export function confirmAndCleanupAfterExport(filename: string): void {
  Alert.alert(
    'Đã lưu dữ liệu tháng trước',
    `Đã lưu file "${filename}" vào bộ nhớ của app (mở bằng ứng dụng Files).\n\n` +
      'Bạn có muốn xoá dữ liệu cũ hơn 35 ngày để gọn nhẹ không? Bản Excel vừa lưu vẫn được giữ.',
    [
      { text: 'Giữ lại', style: 'cancel' },
      {
        text: 'Xoá dữ liệu cũ',
        style: 'destructive',
        onPress: () => {
          void runWeeklyCleanup();
        },
      },
    ]
  );
}
