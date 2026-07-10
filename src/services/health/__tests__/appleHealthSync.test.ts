import {
  requestHealthKitPermission,
  getTodayEnergyBurned,
  getTodayEnergyBurnedDetailed,
  calculateTotalBurned,
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

jest.mock('react-native-health', () => ({
  __esModule: true,
  default: {
    Constants: {
      Permissions: {
        ActiveEnergyBurned: 'ActiveEnergyBurned',
        BasalEnergyBurned: 'BasalEnergyBurned',
      },
    },
    initHealthKit: (...args: unknown[]) => mockInitHealthKit(...args),
    isAvailable: (...args: unknown[]) => mockIsAvailable(...args),
    getActiveEnergyBurned: (...args: unknown[]) => mockGetActiveEnergyBurned(...args),
    getBasalEnergyBurned: (...args: unknown[]) => mockGetBasalEnergyBurned(...args),
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
