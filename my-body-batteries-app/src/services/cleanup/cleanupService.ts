import { deleteReadingsBefore } from '../../data/repositories/batteryRepository';
import { deleteIntakeEventsBefore } from '../../data/repositories/intakeRepository';
import { deleteLogsBefore } from '../../data/repositories/dailyLogRepository';
import { daysAgo } from '../../lib/dateUtils';
import { DATA_RETENTION_DAYS } from '../../lib/constants';

export async function runWeeklyCleanup(): Promise<void> {
  const cutoff = daysAgo(DATA_RETENTION_DAYS);
  await deleteReadingsBefore(cutoff);
  await deleteIntakeEventsBefore(cutoff);
  await deleteLogsBefore(cutoff);
}
