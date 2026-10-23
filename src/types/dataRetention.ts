// How long logged data stays in the app before it is backed up and trimmed
// (Settings → Dữ liệu). See docs/nghien-cuu/2026-10-23-luu-tru-theo-nam-va-kho-du-lieu.md
// and src/domain/retention/retentionSchedule.ts for the cycle.

// null = keep everything, never trim.
export type RetentionMonths = 3 | 6 | 12 | 24 | null;
export const RETENTION_MONTH_OPTIONS: RetentionMonths[] = [3, 6, 12, 24, null];

// Share of the period still kept in the app right after a trim (½ of 1 year =
// the newest 6 months stay).
export type RetentionKeepFraction = 0.25 | 0.5 | 0.75;
export const RETENTION_KEEP_OPTIONS: RetentionKeepFraction[] = [0.25, 0.5, 0.75];

// The long-term "Kho": data kept forever (never trimmed) so the charts can
// show every year of it.
export type ArchiveKind = 'weight' | 'gym' | 'eatingHabits';
export const ARCHIVE_KINDS: ArchiveKind[] = ['weight', 'gym', 'eatingHabits'];

export interface DataRetentionSettings {
  months: RetentionMonths;
  keepFraction: RetentionKeepFraction;
  archive: Record<ArchiveKind, boolean>;
  // The one-time "how long should we keep your data?" sheet was answered.
  setupDone: boolean;
}

// Everything in the Kho by default — nothing that used to be kept forever
// (weight, training) starts being trimmed unless the user turns it off.
export const DEFAULT_DATA_RETENTION: DataRetentionSettings = {
  months: 12,
  keepFraction: 0.5,
  archive: { weight: true, gym: true, eatingHabits: true },
  setupDone: false,
};

// Merges in defaults for fields added after this device last saved.
export function resolveDataRetention(stored: Partial<DataRetentionSettings> | undefined): DataRetentionSettings {
  return {
    ...DEFAULT_DATA_RETENTION,
    ...stored,
    archive: { ...DEFAULT_DATA_RETENTION.archive, ...stored?.archive },
  };
}
