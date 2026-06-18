// Expo SDK 54 moved the classic file API behind `/legacy`. The main entry now
// exports the new File/Directory API, where `documentDirectory` /
// `writeAsStringAsync` / `EncodingType` are missing or throw at runtime.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { utils, write } from 'xlsx';
import { getReadingsInRange } from '../../data/repositories/batteryRepository';
import { getIntakeEventsInRange } from '../../data/repositories/intakeRepository';
import { todayString, daysAgo } from '../../lib/dateUtils';

export async function exportWeeklyData(): Promise<void> {
  const toDate = todayString();
  const fromDate = daysAgo(7);

  const readings = await getReadingsInRange(fromDate, toDate);
  const intakes = await getIntakeEventsInRange(fromDate, toDate);

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

  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.json_to_sheet(readingRows), 'Battery Readings');
  utils.book_append_sheet(wb, utils.json_to_sheet(intakeRows), 'Intake Events');

  const wbout = write(wb, { type: 'base64', bookType: 'xlsx' });

  const filename = `body_batteries_${fromDate}_${toDate}.xlsx`;
  const uri = FileSystem.documentDirectory + filename;

  await FileSystem.writeAsStringAsync(uri, wbout, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Xuất dữ liệu Body Batteries',
    });
  }
}
