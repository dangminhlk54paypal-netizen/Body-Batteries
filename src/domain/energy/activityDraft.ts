import type { ActivityType } from '../../types/energy';

// What the user has typed in the activity sheet so far. Kept (on the device)
// when the sheet closes by accident, so reopening continues where they were;
// dropped by the Cancel button, after logging, or once it is older than
// DRAFT_TTL_MS — a stale half-filled form confuses more than it helps.
export interface ActivityDraft {
  category: string;
  activity: ActivityType;
  customId: string | null;
  minutes: string;
  steps: string;
  startTime: string; // "HH:mm" or ''
  endTime: string;
  date: string; // YYYY-MM-DD
  // Minutes were filled from the time range (or the habit prefill), so a new
  // time range may overwrite them; a hand-typed value never is.
  minutesAuto: boolean;
  // Fields came from the "as usual" prefill (shows the 💡 line).
  prefilled: boolean;
}

export const DRAFT_TTL_MS = 5 * 60 * 1000;

export function blankDraft(today: string): ActivityDraft {
  return {
    category: 'cardio',
    activity: 'running',
    customId: null,
    minutes: '',
    steps: '',
    startTime: '',
    endTime: '',
    date: today,
    minutesAuto: false,
    prefilled: false,
  };
}

export function isDraftFresh(savedAt: number, now: number): boolean {
  return now - savedAt >= 0 && now - savedAt <= DRAFT_TTL_MS;
}

// Nothing worth restoring: no numbers, no times, no past date.
export function isDraftBlank(d: ActivityDraft, today: string): boolean {
  return !d.minutes && !d.steps && !d.startTime && !d.endTime && d.date === today;
}

function parseHHmm(v: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(v.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// Length of "HH:mm → HH:mm"; crossing midnight counts forward (23:30 → 00:15 = 45).
export function minutesBetween(start: string, end: string): number | null {
  const a = parseHHmm(start);
  const b = parseHHmm(end);
  if (a === null || b === null) return null;
  const diff = (b - a + 1440) % 1440;
  return diff > 0 ? diff : null;
}

// Apply a time edit; fill minutes from the range unless the user typed them.
export function withTimes(d: ActivityDraft, startTime: string, endTime: string): ActivityDraft {
  const next = { ...d, startTime, endTime };
  const span = minutesBetween(startTime, endTime);
  if (span !== null && (d.minutes === '' || d.minutesAuto)) {
    return { ...next, minutes: String(span), minutesAuto: true };
  }
  return next;
}

// Turn an "as usual" suggestion into the form's starting values. A custom
// activity is matched by name among the user's current custom activities;
// if it has since been deleted there is nothing to prefill (null).
export function draftFromPrefill(
  base: ActivityDraft,
  p: {
    type: ActivityType;
    customName?: string;
    minutes: number;
    startTime?: string;
    endTime?: string;
  },
  customs: { id: string; nameVi: string; category: string }[],
  categoryOf: (type: ActivityType) => string | null
): ActivityDraft | null {
  const times = { startTime: p.startTime ?? '', endTime: p.endTime ?? '' };
  const common = { ...base, ...times, minutes: String(p.minutes), minutesAuto: true, prefilled: true };
  if (p.type === 'custom') {
    const c = customs.find((x) => x.nameVi === p.customName);
    return c ? { ...common, category: c.category, customId: c.id } : null;
  }
  const category = categoryOf(p.type);
  return category ? { ...common, category, activity: p.type, customId: null } : null;
}
