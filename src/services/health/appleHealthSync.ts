// Pure service wrapper around `react-native-health` (iOS HealthKit). Reads
// today's active + resting (basal) energy burned in kcal.
//
// Deliberately has ZERO dependency on Zustand, SQLite, or React — it's a
// thin, easily-mockable bridge to the native module, so it can be unit
// tested by mocking 'react-native-health' alone. The store/repository layer
// (src/store/energyStore.ts) owns caching, persistence, and the BMR fallback.
//
// `react-native-health`'s `index.js` does `Object.assign({}, NativeModules
// .AppleHealthKit, {...})` at import time — on Android, in Expo Go, or
// before a dev client with the native module linked is built, that native
// module is undefined and every method on the resulting object is simply
// missing (not a stub that errors). `isHealthKitLinked()` detects that case
// up front so we return a typed 'unavailable' result instead of throwing
// "... is not a function".
import AppleHealthKit, {
  type HealthInputOptions,
  type HealthKitPermissions,
  type HealthValue,
} from 'react-native-health';

// Discriminated status so callers (the store) can pick the right
// `appleHealthStatus` without inspecting error messages:
//   - 'success'          real HealthKit data for today
//   - 'permission_denied' the user declined the HealthKit read prompt
//   - 'unavailable'      HealthKit isn't present on this device/build
//                        (Android, Expo Go, iPad without Health, no native
//                        module linked yet)
//   - 'no_data'          HealthKit is available and permitted, but there are
//                        no active/resting energy samples recorded yet today
//   - 'error'            an unexpected failure reading the native module
export type HealthSyncStatus =
  | 'success'
  | 'permission_denied'
  | 'unavailable'
  | 'no_data'
  | 'error';

export interface HealthSyncResult {
  status: HealthSyncStatus;
  active: number;
  resting: number;
}

// True only when the native HealthKit bridge is actually linked (dev client
// built with react-native-health's config plugin applied) — NOT merely that
// the JS module imported without throwing.
function isHealthKitLinked(): boolean {
  return (
    typeof AppleHealthKit?.initHealthKit === 'function' &&
    typeof AppleHealthKit?.isAvailable === 'function' &&
    typeof AppleHealthKit?.getActiveEnergyBurned === 'function' &&
    typeof AppleHealthKit?.getBasalEnergyBurned === 'function'
  );
}

function checkIsAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    AppleHealthKit.isAvailable((_err: unknown, available: boolean) => {
      resolve(!!available);
    });
  });
}

// Requests read access to active + resting (basal) energy burned. Resolves
// `false` (never rejects) on any failure: HealthKit not linked, unavailable
// on this device, or the user declining the permission prompt.
export function requestHealthKitPermission(): Promise<boolean> {
  if (!isHealthKitLinked()) return Promise.resolve(false);

  const permissions: HealthKitPermissions = {
    permissions: {
      read: [
        AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
        AppleHealthKit.Constants.Permissions.BasalEnergyBurned,
      ],
      write: [],
    },
  };

  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(permissions, (error: string) => {
      resolve(!error);
    });
  });
}

// Wraps one of AppleHealthKit's callback-style sample queries in a Promise.
function querySamples(
  queryFn: (
    options: HealthInputOptions,
    callback: (err: string, results: HealthValue[]) => void
  ) => void,
  options: HealthInputOptions
): Promise<HealthValue[]> {
  return new Promise((resolve, reject) => {
    queryFn(options, (err, results) => {
      if (err) {
        reject(new Error(err));
        return;
      }
      resolve(results ?? []);
    });
  });
}

function sumSampleValues(samples: HealthValue[]): number {
  return samples.reduce((sum, s) => sum + (Number.isFinite(s?.value) ? s.value : 0), 0);
}

function todayQueryOptions(): HealthInputOptions {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { startDate: startOfDay.toISOString(), endDate: now.toISOString() };
}

// Full discriminated result — see HealthSyncStatus above. Exported so the
// store/tests can distinguish "permission denied" from "unavailable" from
// "no data" from "success", not just success/failure.
export async function getTodayEnergyBurnedDetailed(): Promise<HealthSyncResult> {
  if (!isHealthKitLinked()) {
    return { status: 'unavailable', active: 0, resting: 0 };
  }

  const available = await checkIsAvailable();
  if (!available) {
    return { status: 'unavailable', active: 0, resting: 0 };
  }

  const granted = await requestHealthKitPermission();
  if (!granted) {
    return { status: 'permission_denied', active: 0, resting: 0 };
  }

  try {
    const options = todayQueryOptions();
    const [activeSamples, restingSamples] = await Promise.all([
      querySamples(AppleHealthKit.getActiveEnergyBurned.bind(AppleHealthKit), options),
      querySamples(AppleHealthKit.getBasalEnergyBurned.bind(AppleHealthKit), options),
    ]);

    if (activeSamples.length === 0 && restingSamples.length === 0) {
      return { status: 'no_data', active: 0, resting: 0 };
    }

    return {
      status: 'success',
      active: sumSampleValues(activeSamples),
      resting: sumSampleValues(restingSamples),
    };
  } catch {
    return { status: 'error', active: 0, resting: 0 };
  }
}

// Convenience wrapper: `null` unless HealthKit returned real data (status
// 'success'). This is the shape most callers actually want.
export async function getTodayEnergyBurned(): Promise<{
  active: number;
  resting: number;
} | null> {
  const result = await getTodayEnergyBurnedDetailed();
  return result.status === 'success' ? { active: result.active, resting: result.resting } : null;
}

// Pure sum with null/NaN guards — never throws, never returns NaN.
export function calculateTotalBurned(active: number, resting: number): number {
  const a = typeof active === 'number' && Number.isFinite(active) ? active : 0;
  const r = typeof resting === 'number' && Number.isFinite(resting) ? resting : 0;
  return a + r;
}

// ── Steps + last night's sleep (read-only, not yet fed into any battery) ────
// Kept separate from the energy request above so the existing kcal sync and
// its permission prompt behave exactly as before. Like the kcal numbers
// (roadmap S-F2), these are display/suggestion inputs only for now: feeding
// them into the movement/sleep batteries would double-count what the user
// already logs by hand. Needs a dev-client build — in Expo Go the bridge is
// missing and this returns 'unavailable'.

export interface HealthDayActivityResult {
  status: HealthSyncStatus;
  steps: number;
  sleepHours: number;
}

// HealthKit sleep sample shape: `value` is a string category despite the
// library typing it as a number.
export interface SleepSample {
  startDate: string;
  endDate: string;
  value: unknown;
}

// Asleep categories (older "ASLEEP" plus the iOS 16+ stages). INBED and
// AWAKE don't count as sleep.
const ASLEEP_VALUES = new Set(['ASLEEP', 'CORE', 'DEEP', 'REM']);

// Pure: total hours asleep across the samples, with overlapping intervals
// merged first — a watch and a phone often both record the same night, and
// stage samples overlap an ASLEEP sample. Rounded to 0.1 h.
export function sleepHoursFromSamples(samples: SleepSample[]): number {
  const intervals = samples
    .filter((s) => typeof s.value === 'string' && ASLEEP_VALUES.has(s.value.toUpperCase()))
    .map((s) => [Date.parse(s.startDate), Date.parse(s.endDate)] as const)
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .sort((x, y) => x[0] - y[0]);
  let totalMs = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [a, b] of intervals) {
    if (a > curEnd) {
      if (curEnd > curStart) totalMs += curEnd - curStart;
      curStart = a;
      curEnd = b;
    } else if (b > curEnd) {
      curEnd = b;
    }
  }
  if (curEnd > curStart) totalMs += curEnd - curStart;
  return Math.round((totalMs / 3_600_000) * 10) / 10;
}

// Last night = from 18:00 yesterday until now.
function lastNightWindow(now: Date): HealthInputOptions {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 18);
  return { startDate: start.toISOString(), endDate: now.toISOString() };
}

function isStepsSleepLinked(): boolean {
  return (
    typeof AppleHealthKit?.initHealthKit === 'function' &&
    typeof AppleHealthKit?.isAvailable === 'function' &&
    typeof AppleHealthKit?.getStepCount === 'function' &&
    typeof AppleHealthKit?.getSleepSamples === 'function'
  );
}

function requestStepsSleepPermission(): Promise<boolean> {
  const permissions: HealthKitPermissions = {
    permissions: {
      read: [AppleHealthKit.Constants.Permissions.StepCount, AppleHealthKit.Constants.Permissions.SleepAnalysis],
      write: [],
    },
  };
  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(permissions, (error: string) => resolve(!error));
  });
}

// Today's step count + hours asleep last night. Never throws.
export async function getTodayStepsAndSleep(now: Date = new Date()): Promise<HealthDayActivityResult> {
  if (!isStepsSleepLinked()) return { status: 'unavailable', steps: 0, sleepHours: 0 };
  if (!(await checkIsAvailable())) return { status: 'unavailable', steps: 0, sleepHours: 0 };
  if (!(await requestStepsSleepPermission())) return { status: 'permission_denied', steps: 0, sleepHours: 0 };

  try {
    const [stepResult, sleepSamples] = await Promise.all([
      new Promise<HealthValue>((resolve, reject) => {
        AppleHealthKit.getStepCount({ date: now.toISOString() }, (err, result) =>
          err ? reject(new Error(err)) : resolve(result)
        );
      }),
      querySamples(AppleHealthKit.getSleepSamples.bind(AppleHealthKit), lastNightWindow(now)),
    ]);
    const steps = Number.isFinite(stepResult?.value) ? Math.round(stepResult.value) : 0;
    const sleepHours = sleepHoursFromSamples(sleepSamples as unknown as SleepSample[]);
    if (steps === 0 && sleepHours === 0) return { status: 'no_data', steps: 0, sleepHours: 0 };
    return { status: 'success', steps, sleepHours };
  } catch {
    return { status: 'error', steps: 0, sleepHours: 0 };
  }
}
