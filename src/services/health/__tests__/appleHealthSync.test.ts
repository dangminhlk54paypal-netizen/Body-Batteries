import {
  requestHealthKitPermission,
  getTodayEnergyBurned,
  getTodayEnergyBurnedDetailed,
  calculateTotalBurned,
  getTodayStepsAndSleep,
  sleepHoursFromSamples,
} from '../appleHealthSync';

// Mock the native bridge module entirely — this service must be testable
// without a real HealthKit-linked dev client. `react-native-health`'s real
// index.js does `Object.assign({}, NativeModules.AppleHealthKit, {
// Constants })`, so our mock mirrors that shape: a default export object with
// the query methods + a `Constants.Permissions` map.
const mockInitHealthKit = jest.fn();
const mockIsAvailable = jest.fn();
const mockGetActiveEnergyBurned = jest.fn();
const mockGetBasalEnergyBurned = jest.fn();
const mockGetStepCount = jest.fn();
const mockGetSleepSamples = jest.fn();

jest.mock('react-native-health', () => ({
  __esModule: true,
  default: {
    Constants: {
      Permissions: {
        ActiveEnergyBurned: 'ActiveEnergyBurned',
        BasalEnergyBurned: 'BasalEnergyBurned',
        StepCount: 'StepCount',
        SleepAnalysis: 'SleepAnalysis',
      },
    },
    initHealthKit: (...args: unknown[]) => mockInitHealthKit(...args),
    isAvailable: (...args: unknown[]) => mockIsAvailable(...args),
    getActiveEnergyBurned: (...args: unknown[]) => mockGetActiveEnergyBurned(...args),
    getBasalEnergyBurned: (...args: unknown[]) => mockGetBasalEnergyBurned(...args),
    getStepCount: (...args: unknown[]) => mockGetStepCount(...args),
    getSleepSamples: (...args: unknown[]) => mockGetSleepSamples(...args),
  },
}));

// Convenience: wire the mocks up for the "happy path" (linked, available,
// permission granted) — individual tests override one mock to simulate a
// specific failure mode.
function mockAvailableAndGranted() {
  mockIsAvailable.mockImplementation((cb: (err: unknown, available: boolean) => void) => {
    cb({}, true);
  });
  mockInitHealthKit.mockImplementation(
    (_perms: unknown, cb: (error: string, result: unknown) => void) => {
      cb('', {});
    }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('calculateTotalBurned', () => {
  it('sums active + resting', () => {
    expect(calculateTotalBurned(300, 1500)).toBe(1800);
  });

  it('treats a 0/undefined stream as 0, not NaN', () => {
    expect(calculateTotalBurned(0, 1500)).toBe(1500);
    expect(calculateTotalBurned(300, undefined as unknown as number)).toBe(300);
  });

  it('guards against NaN inputs', () => {
    expect(calculateTotalBurned(NaN, 100)).toBe(100);
  });
});

describe('requestHealthKitPermission', () => {
  it('resolves true when initHealthKit succeeds', async () => {
    mockIsAvailable.mockImplementation((cb: (err: unknown, available: boolean) => void) =>
      cb({}, true)
    );
    mockInitHealthKit.mockImplementation(
      (_perms: unknown, cb: (error: string, result: unknown) => void) => cb('', {})
    );
    await expect(requestHealthKitPermission()).resolves.toBe(true);
  });

  it('resolves false when the user denies the permission prompt', async () => {
    mockInitHealthKit.mockImplementation(
      (_perms: unknown, cb: (error: string, result: unknown) => void) =>
        cb('permission denied', undefined)
    );
    await expect(requestHealthKitPermission()).resolves.toBe(false);
  });
});

describe('getTodayEnergyBurnedDetailed / getTodayEnergyBurned', () => {
  it('returns success + sums samples when granted and data exists', async () => {
    mockAvailableAndGranted();
    mockGetActiveEnergyBurned.mockImplementation(
      (_opts: unknown, cb: (err: string, results: { value: number }[]) => void) =>
        cb('', [{ value: 150 }, { value: 50 }])
    );
    mockGetBasalEnergyBurned.mockImplementation(
      (_opts: unknown, cb: (err: string, results: { value: number }[]) => void) =>
        cb('', [{ value: 1400 }])
    );

    const detailed = await getTodayEnergyBurnedDetailed();
    expect(detailed).toEqual({ status: 'success', active: 200, resting: 1400 });

    const simple = await getTodayEnergyBurned();
    expect(simple).toEqual({ active: 200, resting: 1400 });
  });

  it('sums correctly when one stream is 0/empty', async () => {
    mockAvailableAndGranted();
    mockGetActiveEnergyBurned.mockImplementation(
      (_opts: unknown, cb: (err: string, results: { value: number }[]) => void) =>
        cb('', [{ value: 0 }])
    );
    mockGetBasalEnergyBurned.mockImplementation(
      (_opts: unknown, cb: (err: string, results: { value: number }[]) => void) =>
        cb('', [{ value: 1300 }])
    );

    const detailed = await getTodayEnergyBurnedDetailed();
    expect(detailed).toEqual({ status: 'success', active: 0, resting: 1300 });
  });

  it('returns unavailable when HealthKit is not linked (methods missing)', async () => {
    jest.resetModules();
    jest.doMock('react-native-health', () => ({
      __esModule: true,
      default: { Constants: { Permissions: {} } }, // no methods — unlinked native module
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../appleHealthSync') as typeof import('../appleHealthSync');

    const detailed = await mod.getTodayEnergyBurnedDetailed();
    expect(detailed.status).toBe('unavailable');
    expect(await mod.getTodayEnergyBurned()).toBeNull();

    jest.dontMock('react-native-health');
    jest.resetModules();
  });

  it('returns unavailable when HealthKit reports isAvailable(false) (e.g. iPad)', async () => {
    mockIsAvailable.mockImplementation((cb: (err: unknown, available: boolean) => void) =>
      cb({}, false)
    );

    const detailed = await getTodayEnergyBurnedDetailed();
    expect(detailed.status).toBe('unavailable');
    expect(await getTodayEnergyBurned()).toBeNull();
  });

  it('returns permission_denied when the user declines the read prompt', async () => {
    mockIsAvailable.mockImplementation((cb: (err: unknown, available: boolean) => void) =>
      cb({}, true)
    );
    mockInitHealthKit.mockImplementation(
      (_perms: unknown, cb: (error: string, result: unknown) => void) =>
        cb('denied', undefined)
    );

    const detailed = await getTodayEnergyBurnedDetailed();
    expect(detailed.status).toBe('permission_denied');
    expect(await getTodayEnergyBurned()).toBeNull();
  });

  it('returns no_data when granted but neither stream has samples today', async () => {
    mockAvailableAndGranted();
    mockGetActiveEnergyBurned.mockImplementation(
      (_opts: unknown, cb: (err: string, results: { value: number }[]) => void) => cb('', [])
    );
    mockGetBasalEnergyBurned.mockImplementation(
      (_opts: unknown, cb: (err: string, results: { value: number }[]) => void) => cb('', [])
    );

    const detailed = await getTodayEnergyBurnedDetailed();
    expect(detailed.status).toBe('no_data');
    expect(await getTodayEnergyBurned()).toBeNull();
  });

  it('returns error when a query rejects unexpectedly', async () => {
    mockAvailableAndGranted();
    mockGetActiveEnergyBurned.mockImplementation(
      (_opts: unknown, cb: (err: string, results: { value: number }[]) => void) =>
        cb('boom', undefined as unknown as { value: number }[])
    );
    mockGetBasalEnergyBurned.mockImplementation(
      (_opts: unknown, cb: (err: string, results: { value: number }[]) => void) =>
        cb('', [{ value: 1000 }])
    );

    const detailed = await getTodayEnergyBurnedDetailed();
    expect(detailed.status).toBe('error');
    expect(await getTodayEnergyBurned()).toBeNull();
  });
});

describe('sleepHoursFromSamples', () => {
  const S = (start: string, end: string, value: string) => ({
    startDate: `2026-09-26T${start}:00.000Z`,
    endDate: `2026-09-26T${end}:00.000Z`,
    value,
  });

  it('counts asleep stages, ignores in-bed/awake, and merges overlaps from two devices', () => {
    const hours = sleepHoursFromSamples([
      S('00:00', '07:30', 'INBED'),
      S('00:30', '03:00', 'CORE'),
      S('02:00', '04:00', 'ASLEEP'), // overlaps the CORE sample (watch + phone)
      S('04:00', '04:15', 'AWAKE'),
      S('04:15', '07:00', 'deep'),
    ]);
    expect(hours).toBe(6.3); // 00:30–04:00 (3.5 h) + 04:15–07:00 (2.75 h)
  });

  it('returns 0 for no usable samples', () => {
    expect(sleepHoursFromSamples([])).toBe(0);
    expect(sleepHoursFromSamples([{ startDate: 'x', endDate: 'y', value: 'ASLEEP' }])).toBe(0);
  });
});

describe('getTodayStepsAndSleep', () => {
  it('reads today\'s steps and last night\'s sleep when linked and permitted', async () => {
    mockAvailableAndGranted();
    mockGetStepCount.mockImplementation((_o: unknown, cb: (e: string, r: { value: number }) => void) => cb('', { value: 6543.4 }));
    mockGetSleepSamples.mockImplementation((_o: unknown, cb: (e: string, r: unknown[]) => void) =>
      cb('', [{ startDate: '2026-09-25T23:00:00.000Z', endDate: '2026-09-26T06:30:00.000Z', value: 'ASLEEP' }])
    );
    await expect(getTodayStepsAndSleep(new Date('2026-09-26T09:00:00Z'))).resolves.toEqual({
      status: 'success',
      steps: 6543,
      sleepHours: 7.5,
    });
  });

  it('reports permission_denied without querying', async () => {
    mockIsAvailable.mockImplementation((cb: (err: unknown, a: boolean) => void) => cb({}, true));
    mockInitHealthKit.mockImplementation((_p: unknown, cb: (error: string) => void) => cb('denied'));
    await expect(getTodayStepsAndSleep()).resolves.toEqual({ status: 'permission_denied', steps: 0, sleepHours: 0 });
    expect(mockGetStepCount).not.toHaveBeenCalled();
  });

  it('turns a native error into status error, never a throw', async () => {
    mockAvailableAndGranted();
    mockGetStepCount.mockImplementation((_o: unknown, cb: (e: string, r: unknown) => void) => cb('boom', null));
    mockGetSleepSamples.mockImplementation((_o: unknown, cb: (e: string, r: unknown[]) => void) => cb('', []));
    await expect(getTodayStepsAndSleep()).resolves.toEqual({ status: 'error', steps: 0, sleepHours: 0 });
  });
});
