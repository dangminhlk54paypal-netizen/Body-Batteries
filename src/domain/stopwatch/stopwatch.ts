// Pure stopwatch logic (Apple Clock style). No I/O — unit-tested.
// Time is anchored to wall-clock timestamps rather than counted by ticks, so
// the stopwatch stays correct while the app is backgrounded or closed.

export interface StopwatchState {
  startedAt: number | null; // unix ms of the current run; null when stopped
  accumulatedMs: number; // elapsed time from previous runs
  lapMarksMs: number[]; // total elapsed at each "Vòng" press, oldest first
}

export const INITIAL_STOPWATCH: StopwatchState = {
  startedAt: null,
  accumulatedMs: 0,
  lapMarksMs: [],
};

export function isRunning(s: StopwatchState): boolean {
  return s.startedAt !== null;
}

export function elapsedMs(s: StopwatchState, now: number): number {
  const running = s.startedAt !== null ? Math.max(0, now - s.startedAt) : 0;
  return s.accumulatedMs + running;
}

export function start(s: StopwatchState, now: number): StopwatchState {
  return s.startedAt !== null ? s : { ...s, startedAt: now };
}

export function stop(s: StopwatchState, now: number): StopwatchState {
  if (s.startedAt === null) return s;
  return { ...s, startedAt: null, accumulatedMs: elapsedMs(s, now) };
}

export function lap(s: StopwatchState, now: number): StopwatchState {
  if (s.startedAt === null) return s;
  return { ...s, lapMarksMs: [...s.lapMarksMs, elapsedMs(s, now)] };
}

// Durations of completed laps, oldest first.
export function lapDurations(s: StopwatchState): number[] {
  return s.lapMarksMs.map((mark, i) => mark - (i === 0 ? 0 : s.lapMarksMs[i - 1]));
}

// Time on the lap currently in progress.
export function currentLapMs(s: StopwatchState, now: number): number {
  const last = s.lapMarksMs.length > 0 ? s.lapMarksMs[s.lapMarksMs.length - 1] : 0;
  return elapsedMs(s, now) - last;
}

// Indexes of the fastest / slowest completed laps. Like Apple's Clock app,
// only highlighted once there are at least 2 completed laps.
export function bestWorstLaps(durations: number[]): { best: number; worst: number } | null {
  if (durations.length < 2) return null;
  let best = 0;
  let worst = 0;
  durations.forEach((d, i) => {
    if (d < durations[best]) best = i;
    if (d > durations[worst]) worst = i;
  });
  return best === worst ? null : { best, worst };
}

// "mm:ss,cc" (or "h:mm:ss,cc" past one hour) — comma decimal as on a
// Vietnamese-locale iPhone.
export function formatStopwatch(ms: number): string {
  const totalCs = Math.floor(Math.max(0, ms) / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const min = totalMin % 60;
  const hours = Math.floor(totalMin / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  const base = `${pad(min)}:${pad(sec)},${pad(cs)}`;
  return hours > 0 ? `${hours}:${base}` : base;
}
