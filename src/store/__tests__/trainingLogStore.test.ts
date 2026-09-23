import { useTrainingLogStore } from '../trainingLogStore';
import { useSettingsStore } from '../settingsStore';
import { DEFAULT_TRAINING_LOG_FORMAT } from '../../types/trainingLog';
import type { ActivityLogEntry } from '../../types/energy';
import type { TrainingLogDayRecord } from '../../types/trainingLog';
import * as activityLogRepository from '../../data/repositories/activityLogRepository';
import * as trainingBlockRepository from '../../data/repositories/trainingBlockRepository';
import * as trainingLogRepository from '../../data/repositories/trainingLogRepository';

// Same shims as the other store tests: keep expo-sqlite and AsyncStorage out
// of the import chain, and replace every repository with an auto-mock so this
// suite tests only the store's own rules (what it writes, when it reloads).
jest.mock('../../data/db/database', () => ({ getDb: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../data/repositories/activityLogRepository');
jest.mock('../../data/repositories/trainingBlockRepository');
jest.mock('../../data/repositories/trainingLogRepository');

const repo = jest.mocked(trainingLogRepository);
const activityRepo = jest.mocked(activityLogRepository);
const blockRepo = jest.mocked(trainingBlockRepository);

const day = (patch: Partial<TrainingLogDayRecord> = {}): TrainingLogDayRecord => ({
  date: '2026-08-26',
  overrideText: null,
  note: null,
  sourceSignature: null,
  updatedAt: 1,
  ...patch,
});

const lastUpsert = () => repo.upsertTrainingLogDay.mock.calls.at(-1)![0];

beforeEach(() => {
  jest.resetAllMocks();
  useSettingsStore.setState({ trainingLogFormat: DEFAULT_TRAINING_LOG_FORMAT, language: 'vi' });
  useTrainingLogStore.setState({ periods: [], loaded: false, revision: 0 });
  // A quiet database: nothing logged, nothing written.
  activityRepo.getTrainingDayCounts.mockResolvedValue([]);
  blockRepo.listTrainingBlocks.mockResolvedValue([]);
  repo.listTrainingLogDates.mockResolvedValue([]);
  repo.listTrainingLogWeekStarts.mockResolvedValue([]);
  repo.getTrainingLogDay.mockResolvedValue(null);
  repo.upsertTrainingLogDay.mockResolvedValue(undefined);
  repo.upsertTrainingLogWeek.mockResolvedValue(undefined);
  repo.deleteTrainingLogDay.mockResolvedValue(undefined);
});

describe('loadIndex', () => {
  it('builds the periods from the repositories and bumps revision', async () => {
    activityRepo.getTrainingDayCounts.mockResolvedValue([{ date: '2026-08-05', sessions: 2 }]);
    repo.listTrainingLogDates.mockResolvedValue(['2026-08-12']);
    await useTrainingLogStore.getState().loadIndex();
    const s = useTrainingLogStore.getState();
    expect(s.loaded).toBe(true);
    expect(s.revision).toBe(1);
    expect(s.periods).toHaveLength(1);
    expect(s.periods[0]).toMatchObject({ kind: 'free', monthKey: '2026-08', sessions: 3 });
  });

  it('bumps revision on every load, so an already-open week reloads after a focus', async () => {
    await useTrainingLogStore.getState().loadIndex();
    await useTrainingLogStore.getState().loadIndex();
    expect(useTrainingLogStore.getState().revision).toBe(2);
  });
});

describe('writing a day', () => {
  it('saveManualDay stores a HAND-WRITTEN line: no signature, comma decimals become dots', async () => {
    await useTrainingLogStore.getState().saveManualDay('2026-08-26', 'S 5x5x72,5', 'ngủ ít, 3,4 lần');
    expect(lastUpsert()).toMatchObject({
      date: '2026-08-26',
      overrideText: 'S 5x5x72.5',
      sourceSignature: null,
      // The note is prose: its comma is left alone.
      note: 'ngủ ít, 3,4 lần',
    });
    expect(useTrainingLogStore.getState().revision).toBe(1); // reloaded the index
  });

  it("keeps the user's own separator when they chose decimal: 'locale'", async () => {
    useSettingsStore.setState({
      trainingLogFormat: { ...DEFAULT_TRAINING_LOG_FORMAT, decimal: 'locale' },
    });
    await useTrainingLogStore.getState().saveManualDay('2026-08-26', 'S 5x5x72,5', '');
    expect(lastUpsert().overrideText).toBe('S 5x5x72,5');
  });

  it('saveDayOverride records the signature and keeps the existing note', async () => {
    repo.getTrainingLogDay.mockResolvedValue(day({ note: 'nặng' }));
    await useTrainingLogStore.getState().saveDayOverride('2026-08-26', 'B 90 (95 ❌) 5x5x75', 'sig1');
    expect(lastUpsert()).toMatchObject({
      overrideText: 'B 90 (95 ❌) 5x5x75',
      sourceSignature: 'sig1',
      note: 'nặng',
    });
  });

  it('clearDayOverride drops the line and signature but keeps the note', async () => {
    repo.getTrainingLogDay.mockResolvedValue(
      day({ overrideText: 'x', sourceSignature: 's', note: 'giữ' })
    );
    await useTrainingLogStore.getState().clearDayOverride('2026-08-26');
    expect(lastUpsert()).toMatchObject({ overrideText: null, sourceSignature: null, note: 'giữ' });
  });

  it('acceptCurrentSignature keeps the text and only re-binds the signature', async () => {
    repo.getTrainingLogDay.mockResolvedValue(day({ overrideText: 'mine', sourceSignature: 'old' }));
    await useTrainingLogStore.getState().acceptCurrentSignature('2026-08-26', 'new');
    expect(lastUpsert()).toMatchObject({ overrideText: 'mine', sourceSignature: 'new' });
  });

  it("acceptCurrentSignature turns a hand-written line into a bound one (no more 'Xả added' banner)", async () => {
    repo.getTrainingLogDay.mockResolvedValue(day({ overrideText: 'mine', sourceSignature: null }));
    await useTrainingLogStore.getState().acceptCurrentSignature('2026-08-26', 'sigNow');
    expect(lastUpsert().sourceSignature).toBe('sigNow');
  });

  it("mergeAutoIntoOverride puts the user's text first, then the auto body, and re-binds", async () => {
    repo.getTrainingLogDay.mockResolvedValue(day({ overrideText: 'B 90 (95 ❌)' }));
    await useTrainingLogStore.getState().mergeAutoIntoOverride('2026-08-26', 'S 130 5x5x100', 'sigNow');
    expect(lastUpsert()).toMatchObject({
      overrideText: 'B 90 (95 ❌) S 130 5x5x100',
      sourceSignature: 'sigNow',
    });
  });

  it('mergeAutoIntoOverride with no existing text is just the auto body', async () => {
    await useTrainingLogStore.getState().mergeAutoIntoOverride('2026-08-26', 'S 130 5x5x100', 's');
    expect(lastUpsert().overrideText).toBe('S 130 5x5x100');
  });

  it('saveDayNote keeps an existing line and signature', async () => {
    repo.getTrainingLogDay.mockResolvedValue(day({ overrideText: 'mine', sourceSignature: 'sig' }));
    await useTrainingLogStore.getState().saveDayNote('2026-08-26', 'quá tải thần kinh');
    expect(lastUpsert()).toMatchObject({
      overrideText: 'mine',
      sourceSignature: 'sig',
      note: 'quá tải thần kinh',
    });
  });

  it('stamps updatedAt from the clock inside the action', async () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(1_234_567);
    await useTrainingLogStore.getState().saveDayNote('2026-08-26', 'x');
    spy.mockRestore();
    expect(lastUpsert().updatedAt).toBe(1_234_567);
  });

  it('deleteDay removes the record and reloads', async () => {
    await useTrainingLogStore.getState().deleteDay('2026-08-26');
    expect(repo.deleteTrainingLogDay).toHaveBeenCalledWith('2026-08-26');
    expect(useTrainingLogStore.getState().revision).toBe(1);
  });

  it('never touches activity_log: no activity write is ever called', async () => {
    await useTrainingLogStore.getState().saveManualDay('2026-08-26', 'S 100 5', '');
    await useTrainingLogStore.getState().deleteDay('2026-08-26');
    expect(activityRepo.addActivityLogEntry).not.toHaveBeenCalled();
    expect(activityRepo.updateActivityLogEntry).not.toHaveBeenCalled();
    expect(activityRepo.deleteActivityLogEntry).not.toHaveBeenCalled();
  });
});

describe('saveWeekNote', () => {
  it('upserts the note for that Monday and reloads', async () => {
    await useTrainingLogStore.getState().saveWeekNote('2026-08-24', 'oneweekHOLIDAYS');
    expect(repo.upsertTrainingLogWeek).toHaveBeenCalledWith(
      expect.objectContaining({ weekStart: '2026-08-24', note: 'oneweekHOLIDAYS' })
    );
    expect(useTrainingLogStore.getState().revision).toBe(1);
  });
});

describe('findPreviousDayBody', () => {
  const xaEntry: ActivityLogEntry = {
    id: 'a',
    timestamp: new Date(2026, 7, 24, 18).getTime(),
    steps: 0,
    workouts: [
      {
        type: 'squat',
        minutes: 30,
        sets: [
          { kind: 'working', weightKg: 130, reps: 1 },
          { kind: 'working', weightKg: 115, reps: 3 },
          { kind: 'working', weightKg: 115, reps: 3 },
        ],
      },
    ],
    energyKcal: 0,
    satietyDrainKcal: 0,
    energyDayApplied: '2026-08-24',
  };

  it('returns null when there is nothing earlier', async () => {
    activityRepo.getLatestTrainingDateBefore.mockResolvedValue(null);
    repo.getLatestTrainingLogDayBefore.mockResolvedValue(null);
    expect(await useTrainingLogStore.getState().findPreviousDayBody('2026-08-26')).toBeNull();
  });

  it('formats the latest Xả day when it is the closest', async () => {
    activityRepo.getLatestTrainingDateBefore.mockResolvedValue('2026-08-24');
    repo.getLatestTrainingLogDayBefore.mockResolvedValue(null);
    activityRepo.getActivityLogForDate.mockResolvedValue([xaEntry]);
    expect(await useTrainingLogStore.getState().findPreviousDayBody('2026-08-26')).toBe('S 130 2x3x115');
  });

  it('returns a hand-written line when it is closer than any Xả day', async () => {
    activityRepo.getLatestTrainingDateBefore.mockResolvedValue('2026-08-24');
    repo.getLatestTrainingLogDayBefore.mockResolvedValue(
      day({ date: '2026-08-25', overrideText: 'D 140 6x4x110' })
    );
    expect(await useTrainingLogStore.getState().findPreviousDayBody('2026-08-26')).toBe('D 140 6x4x110');
  });

  it("on the same day the user's own line beats the Xả line", async () => {
    activityRepo.getLatestTrainingDateBefore.mockResolvedValue('2026-08-24');
    repo.getLatestTrainingLogDayBefore.mockResolvedValue(
      day({ date: '2026-08-24', overrideText: 'S 130 (test)' })
    );
    expect(await useTrainingLogStore.getState().findPreviousDayBody('2026-08-26')).toBe('S 130 (test)');
    expect(activityRepo.getActivityLogForDate).not.toHaveBeenCalled();
  });
});
