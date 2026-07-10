import { useEnergyStore } from '../energyStore';
import { useSettingsStore, DEFAULT_USER_PROFILE } from '../settingsStore';
import { dailyExpenditure } from '../../domain/energy/metabolismEngine';
import * as appleHealthSync from '../../services/health/appleHealthSync';
import * as healthSignalsRepository from '../../data/repositories/healthSignalsRepository';

// Same test-environment shims as energyStore.test.ts (see the rationale
// there): keep the generated food catalogs, expo-sqlite and AsyncStorage out
// of the import chain.
jest.mock('../../data/food/foodLookup', () => ({ getAnyFoodById: jest.fn() }));
jest.mock('../../data/db/database', () => ({
  getDb: () => ({
    runAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn().mockResolvedValue([]),
    execAsync: jest.fn().mockResolvedValue(undefined),
    withTransactionAsync: jest.fn(async (cb: () => Promise<void>) => {
      await cb();
    }),
  }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock the pure HealthKit service — this store test cares about
// syncAppleHealthBurned's orchestration (cache/fallback/persistence), not
// HealthKit itself (that's covered by appleHealthSync.test.ts).
jest.mock('../../services/health/appleHealthSync', () => ({
  getTodayEnergyBurned: jest.fn(),
  calculateTotalBurned: (active: number, resting: number) =>
    (Number.isFinite(active) ? active : 0) + (Number.isFinite(resting) ? resting : 0),
}));

// Mock the repository so tests can control/spy on persistence without a real
// DB — healthSignalsRepository itself is unit-tested separately.
jest.mock('../../data/repositories/healthSignalsRepository', () => ({
  logAppleHealthBurned: jest.fn().mockResolvedValue(undefined),
  recordSyncTimestamp: jest.fn().mockResolvedValue(undefined),
  getLastSyncTimestamp: jest.fn().mockResolvedValue(null),
  getAppleHealthBurnedForDate: jest.fn().mockResolvedValue(null),
}));

const mockGetTodayEnergyBurned = appleHealthSync.getTodayEnergyBurned as jest.MockedFunction<
  typeof appleHealthSync.getTodayEnergyBurned
>;
const mockGetLastSyncTimestamp =
  healthSignalsRepository.getLastSyncTimestamp as jest.MockedFunction<
    typeof healthSignalsRepository.getLastSyncTimestamp
  >;
const mockLogAppleHealthBurned =
  healthSignalsRepository.logAppleHealthBurned as jest.MockedFunction<
    typeof healthSignalsRepository.logAppleHealthBurned
  >;
const mockRecordSyncTimestamp =
  healthSignalsRepository.recordSyncTimestamp as jest.MockedFunction<
    typeof healthSignalsRepository.recordSyncTimestamp
  >;
const mockGetAppleHealthBurnedForDate =
  healthSignalsRepository.getAppleHealthBurnedForDate as jest.MockedFunction<
    typeof healthSignalsRepository.getAppleHealthBurnedForDate
  >;

function resetAppleHealthState() {
  useEnergyStore.setState({
    appleHealthBurnedKcal: 0,
    lastAppleHealthSync: null,
    appleHealthStatus: 'idle',
  });
}

describe('energyStore — syncAppleHealthBurned', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetLastSyncTimestamp.mockResolvedValue(null);
    mockGetAppleHealthBurnedForDate.mockResolvedValue(null);
    useSettingsStore.setState({ userProfile: DEFAULT_USER_PROFILE });
    resetAppleHealthState();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('success path: stores the HealthKit kcal total and marks status "synced"', async () => {
    mockGetTodayEnergyBurned.mockResolvedValue({ active: 300, resting: 1500 });

    await useEnergyStore.getState().syncAppleHealthBurned();

    const state = useEnergyStore.getState();
    expect(state.appleHealthBurnedKcal).toBe(1800);
    expect(state.appleHealthStatus).toBe('synced');
    expect(state.lastAppleHealthSync).not.toBeNull();
    expect(mockLogAppleHealthBurned).toHaveBeenCalledWith(1800, expect.any(Number), expect.any(String));
    expect(mockRecordSyncTimestamp).toHaveBeenCalledWith('synced');
  });

  it('failure path (HealthKit returns null): falls back to the BMR estimate, marks status "estimated"', async () => {
    mockGetTodayEnergyBurned.mockResolvedValue(null);

    await useEnergyStore.getState().syncAppleHealthBurned();

    const expected = dailyExpenditure(DEFAULT_USER_PROFILE).total;
    const state = useEnergyStore.getState();
    expect(state.appleHealthBurnedKcal).toBe(expected);
    expect(state.appleHealthStatus).toBe('estimated');
    expect(state.lastAppleHealthSync).not.toBeNull();
    expect(mockRecordSyncTimestamp).toHaveBeenCalledWith('estimated');
    expect(mockLogAppleHealthBurned).not.toHaveBeenCalled();
  });

  it('failure path (HealthKit throws): also falls back to the BMR estimate without throwing', async () => {
    mockGetTodayEnergyBurned.mockRejectedValue(new Error('HealthKit exploded'));

    await expect(useEnergyStore.getState().syncAppleHealthBurned()).resolves.toBeUndefined();

    expect(useEnergyStore.getState().appleHealthStatus).toBe('estimated');
  });

  it('2-hour cache: a recent in-memory lastAppleHealthSync skips re-fetching HealthKit, restores persisted kcal', async () => {
    useEnergyStore.setState({ lastAppleHealthSync: Date.now() - 30 * 60 * 1000 }); // 30 min ago
    mockGetAppleHealthBurnedForDate.mockResolvedValue(1750); // today's row already persisted

    await useEnergyStore.getState().syncAppleHealthBurned();

    expect(mockGetTodayEnergyBurned).not.toHaveBeenCalled();
    const state = useEnergyStore.getState();
    expect(state.appleHealthStatus).toBe('synced');
    expect(state.appleHealthBurnedKcal).toBe(1750);
  });

  it('2-hour cache: a stale in-memory lastAppleHealthSync (>2h) re-fetches', async () => {
    useEnergyStore.setState({ lastAppleHealthSync: Date.now() - 3 * 60 * 60 * 1000 }); // 3h ago
    mockGetTodayEnergyBurned.mockResolvedValue({ active: 100, resting: 1400 });

    await useEnergyStore.getState().syncAppleHealthBurned();

    expect(mockGetTodayEnergyBurned).toHaveBeenCalledTimes(1);
    expect(useEnergyStore.getState().appleHealthStatus).toBe('synced');
  });

  it('2-hour cache: falls back to the persisted timestamp on a fresh app launch (in-memory null), restores persisted kcal', async () => {
    mockGetLastSyncTimestamp.mockResolvedValue(Date.now() - 10 * 60 * 1000); // synced 10 min ago last session
    mockGetAppleHealthBurnedForDate.mockResolvedValue(1900);

    await useEnergyStore.getState().syncAppleHealthBurned();

    expect(mockGetTodayEnergyBurned).not.toHaveBeenCalled();
    const state = useEnergyStore.getState();
    expect(state.lastAppleHealthSync).not.toBeNull();
    expect(state.appleHealthStatus).toBe('synced');
    expect(state.appleHealthBurnedKcal).toBe(1900);
  });

  it('2-hour cache: fresh app launch across a midnight boundary (cached timestamp is from a previous day) falls back to the BMR estimate instead of showing stale/zero data', async () => {
    mockGetLastSyncTimestamp.mockResolvedValue(Date.now() - 10 * 60 * 1000); // 10 min ago by the clock
    mockGetAppleHealthBurnedForDate.mockResolvedValue(null); // but nothing synced yet for TODAY's date key

    await useEnergyStore.getState().syncAppleHealthBurned();

    expect(mockGetTodayEnergyBurned).not.toHaveBeenCalled();
    const expected = dailyExpenditure(DEFAULT_USER_PROFILE).total;
    const state = useEnergyStore.getState();
    expect(state.appleHealthStatus).toBe('estimated');
    expect(state.appleHealthBurnedKcal).toBe(expected);
  });
});

describe('energyStore — loadToday triggers Apple Health sync without breaking the load', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetLastSyncTimestamp.mockResolvedValue(null);
    useSettingsStore.setState({ userProfile: DEFAULT_USER_PROFILE });
    resetAppleHealthState();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves normally even when the Apple Health sync fails', async () => {
    mockGetTodayEnergyBurned.mockRejectedValue(new Error('HealthKit exploded'));

    await expect(useEnergyStore.getState().loadToday('maintain')).resolves.toBeUndefined();
    expect(useEnergyStore.getState().isLoaded).toBe(true);

    // The sync itself is fire-and-forget from loadToday's perspective — flush
    // the macrotask queue so its (already-settled) promise chain fully
    // finishes, then check it landed on the estimated fallback rather than
    // being left 'syncing'.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useEnergyStore.getState().appleHealthStatus).toBe('estimated');
  });

  it('reaches "synced" status when the Apple Health fetch succeeds', async () => {
    mockGetTodayEnergyBurned.mockResolvedValue({ active: 200, resting: 1600 });

    await useEnergyStore.getState().loadToday('maintain');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useEnergyStore.getState().appleHealthStatus).toBe('synced');
    expect(useEnergyStore.getState().appleHealthBurnedKcal).toBe(1800);
  });
});
