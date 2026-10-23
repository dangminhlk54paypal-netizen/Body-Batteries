import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';

// Thin wrapper over expo-sensors' Pedometer. On iPhone it reads CoreMotion —
// the same step source Apple Health records — and can query any range in the
// last 7 days, so an outing is counted correctly even if the app was closed.
// Android can only stream live steps while the app is open (no range query),
// and web has no pedometer at all.

export type PedometerStatus = 'ok' | 'unavailable' | 'denied';

export const canQueryStepRange = Platform.OS === 'ios';

export async function ensurePedometer(): Promise<PedometerStatus> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    if (!(await Pedometer.isAvailableAsync())) return 'unavailable';
    let perm = await Pedometer.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Pedometer.requestPermissionsAsync();
    return perm.granted ? 'ok' : 'denied';
  } catch (e) {
    console.warn('Pedometer check failed:', e);
    return 'unavailable';
  }
}

// Steps between two moments (iOS only). Returns null where unsupported.
export async function getStepsBetween(start: Date, end: Date): Promise<number | null> {
  if (!canQueryStepRange) return null;
  try {
    const { steps } = await Pedometer.getStepCountAsync(start, end);
    return steps;
  } catch (e) {
    console.warn('getStepCountAsync failed:', e);
    return null;
  }
}

// Steps since local midnight — matches the "Steps" number Apple Health shows
// for today on an iPhone-only setup. Null where unsupported.
export async function getTodaySteps(): Promise<number | null> {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return getStepsBetween(midnight, new Date());
}

// Live step stream: the callback gets steps counted since subscribing.
export function watchSteps(onSteps: (stepsSinceStart: number) => void): () => void {
  if (Platform.OS === 'web') return () => {};
  const sub = Pedometer.watchStepCount(({ steps }) => onSteps(steps));
  return () => sub.remove();
}
