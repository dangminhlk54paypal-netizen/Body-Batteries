// Learns how the user reads Home's "Chi tiết hôm nay" rows and, when it fits,
// suggests switching between viewing ONE row at a time (default) and up to
// THREE side by side. It only ever suggests — the switch happens when the user
// agrees (a hand choice always beats automation). Pure; the store persists it.
//
// Signals (see docs/nghien-cuu/2026-09-26-xem-nhieu-muc-cung-luc.md):
// - one-row mode: opening a different row soon after another ("quick switch")
//   means the user is comparing through memory → suggest multi view;
// - multi mode: never having more than one row open → suggest one row again.

export type DetailViewMode = 'single' | 'multi';

export interface DetailOpenEvent {
  id: string; // row that was opened
  at: number; // unix ms
  mode: DetailViewMode; // mode at that moment
  openCount: number; // rows open right after this open
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const QUICK_SWITCH_MS = 20_000;
export const HABIT_WINDOW_MS = 7 * DAY_MS;
export const MIN_QUICK_SWITCHES = 3;
export const MIN_HABIT_DAYS = 2; // spread over ≥ 2 days, not one curious moment
export const SINGLE_CHECK_EVENTS = 10;
export const SNOOZE_MS = 14 * DAY_MS;
const KEEP_MS = 14 * DAY_MS;
const KEEP_EVENTS = 60;

export function openLimit(mode: DetailViewMode): number {
  return mode === 'multi' ? 3 : 1;
}

// Tap a row: close it if open, else open it; past the limit the row opened
// longest ago folds. Order = oldest first.
export function toggleOpen(open: string[], id: string, limit: number): string[] {
  if (open.includes(id)) return open.filter((x) => x !== id);
  return [...open, id].slice(-limit);
}

export function addOpenEvent(log: DetailOpenEvent[], event: DetailOpenEvent): DetailOpenEvent[] {
  return [...log, event].filter((e) => event.at - e.at <= KEEP_MS).slice(-KEEP_EVENTS);
}

function dayKey(at: number): string {
  return new Date(at).toDateString();
}

export function suggestViewMode(
  log: DetailOpenEvent[],
  mode: DetailViewMode,
  now: number,
  snoozedUntil: number
): DetailViewMode | null {
  if (now < snoozedUntil) return null;
  const recent = log.filter((e) => now - e.at <= HABIT_WINDOW_MS && e.mode === mode);

  if (mode === 'single') {
    const days = new Set<string>();
    let quick = 0;
    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1];
      const cur = recent[i];
      if (cur.id !== prev.id && cur.at - prev.at <= QUICK_SWITCH_MS) {
        quick++;
        days.add(dayKey(cur.at));
      }
    }
    return quick >= MIN_QUICK_SWITCHES && days.size >= MIN_HABIT_DAYS ? 'multi' : null;
  }

  const last = recent.slice(-SINGLE_CHECK_EVENTS);
  if (last.length < SINGLE_CHECK_EVENTS) return null;
  const onlyOne = last.every((e) => e.openCount <= 1);
  const days = new Set(last.map((e) => dayKey(e.at)));
  return onlyOne && days.size >= MIN_HABIT_DAYS ? 'single' : null;
}
