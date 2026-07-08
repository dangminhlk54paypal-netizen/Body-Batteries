import { deleteReadingsBefore } from '../../data/repositories/batteryRepository';
import { deleteIntakeEventsBefore } from '../../data/repositories/intakeRepository';
import { deleteLogsBefore } from '../../data/repositories/dailyLogRepository';
import { deleteFoodLogBefore } from '../../data/repositories/foodLogRepository';
import { daysAgo } from '../../lib/dateUtils';
import { DATA_RETENTION_DAYS } from '../../lib/constants';

// Deletes stored data older than DATA_RETENTION_DAYS (35 days ~= 1 month).
// Always user-confirmed before it runs — never deletes silently.
export async function runWeeklyCleanup(): Promise<void> {
  const cutoff = daysAgo(DATA_RETENTION_DAYS);
  await deleteReadingsBefore(cutoff);
  await deleteIntakeEventsBefore(cutoff);
  await deleteLogsBefore(cutoff);
  await deleteFoodLogBefore(cutoff);
}
