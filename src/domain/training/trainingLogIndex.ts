import { addDaysToDateString, mondayOfWeek } from '../../lib/dateUtils';
import type { GeneratedBlockPlan } from '../../types/powerliftingBlock';
import type { TrainingLogPeriod, TrainingLogWeek } from '../../types/trainingLog';

// Groups the days that have something in the training log into
// period (block or free) → week → day, the shape the notebook UI collapses.
// Pure: no store, no clock (`today` is a parameter), no labels — the UI turns
// this into text with t(). See plan §4.2.

export interface TrainingLogIndexInput {
  // Calendar days with ≥ 1 Xả entry that has workouts (steps-only entries never
  // reach the log), with how many entries. Same grouping rule as activity_log
  // history: COALESCE(start_at, timestamp) → calendar day.
  trainingDays: { date: string; sessions: number }[];
  // Days that have a training_log_days row (hand-written line or note).
  logDates: string[];
  // Mondays that have a training_log_weeks note.
  weekNoteStarts: string[];
  blocks: GeneratedBlockPlan[];
  today: string; // YYYY-MM-DD
  // The user's own week labels ("B3W3"), keyed by the week's start.
  weekLabels?: { weekStart: string; label: string }[];
  // The user's own names for free months ("Power Lifting"), keyed YYYY-MM.
  monthNames?: { monthKey: string; name: string }[];
}

interface NumberedBlock {
  plan: GeneratedBlockPlan;
  number: number;
  start: string;
  end: string;
}

function weekOfDate(weeks: TrainingLogWeek[], date: string): number {
  return weeks.findIndex((w) => w.weekStart <= date && date <= w.weekEnd);
}

export function buildTrainingLogIndex(input: TrainingLogIndexInput): TrainingLogPeriod[] {
  const { trainingDays, logDates, weekNoteStarts, blocks, today } = input;
  const labelByWeek = new Map((input.weekLabels ?? []).map((w) => [w.weekStart, w.label.trim()]));
  const nameByMonth = new Map((input.monthNames ?? []).map((m) => [m.monthKey, m.name.trim()]));
  const customLabel = (weekStart: string) => labelByWeek.get(weekStart) || undefined;

  // One count per content day. A day known only from the log (hand-written /
  // note) counts as one entry.
  const sessionsByDate = new Map<string, number>();
  for (const d of trainingDays) {
    sessionsByDate.set(d.date, (sessionsByDate.get(d.date) ?? 0) + d.sessions);
  }
  for (const date of logDates) {
    if (!sessionsByDate.has(date)) sessionsByDate.set(date, 1);
  }
  const noteStarts = new Set(weekNoteStarts);

  // Block numbers follow creation order among the blocks that still exist, so
  // deleting an old block renumbers the rest (plan §8).
  const numbered: NumberedBlock[] = [...blocks]
    .filter((b) => b.weeks.length > 0)
    .sort((a, b) => a.config.createdAt - b.config.createdAt)
    .map((plan, i) => ({
      plan,
      number: i + 1,
      start: plan.weeks[0].startDate,
      end: plan.weeks[plan.weeks.length - 1].endDate,
    }));

  // Per-block week buckets (a copy of the plan's own weeks: dates fill in below).
  const blockWeeks: TrainingLogWeek[][] = numbered.map((nb) =>
    nb.plan.weeks.map((w) => ({
      weekStart: w.startDate,
      weekEnd: w.endDate,
      weekNumber: w.weekNumber,
      isDeload: w.isDeload,
      sessions: 0,
      dates: [],
      customLabel: customLabel(w.startDate),
    }))
  );
  const freeByMonday = new Map<string, string[]>();

  // Overlapping blocks: the newest one owns the day.
  function ownerOf(date: string): number {
    for (let i = numbered.length - 1; i >= 0; i--) {
      if (numbered[i].start <= date && date <= numbered[i].end) return i;
    }
    return -1;
  }

  for (const [date, sessions] of [...sessionsByDate].sort(([a], [b]) => a.localeCompare(b))) {
    const owner = ownerOf(date);
    const wi = owner >= 0 ? weekOfDate(blockWeeks[owner], date) : -1;
    if (owner >= 0 && wi >= 0) {
      blockWeeks[owner][wi].dates.push(date);
      blockWeeks[owner][wi].sessions += sessions;
    } else {
      const monday = mondayOfWeek(date);
      freeByMonday.set(monday, [...(freeByMonday.get(monday) ?? []), date]);
    }
  }

  // A week note on a Monday outside every block keeps that (otherwise empty)
  // free week visible.
  for (const monday of noteStarts) {
    const insideBlock = numbered.some((nb) => nb.start <= monday && monday <= nb.end);
    if (!insideBlock && !freeByMonday.has(monday)) freeByMonday.set(monday, []);
  }

  const periods: TrainingLogPeriod[] = [];

  numbered.forEach((nb, idx) => {
    const coveredByNewer = (weekStart: string) =>
      numbered.slice(idx + 1).some((newer) => newer.start <= weekStart && weekStart <= newer.end);
    // Every week up to the current one stays (empty ones too, so "one week
    // holiday" can get a note); a future week only appears once it has content.
    // An empty week that a newer block already covers is hidden.
    const weeks = blockWeeks[idx].filter((w) => {
      if (w.dates.length > 0 || noteStarts.has(w.weekStart)) return true;
      return w.weekStart <= today && !coveredByNewer(w.weekStart);
    });
    if (weeks.length === 0) return;
    periods.push({
      key: `block:${nb.plan.config.id}`,
      kind: 'block',
      blockId: nb.plan.config.id,
      blockNumber: nb.number,
      blockName: nb.plan.config.name?.trim() || undefined,
      focus: nb.plan.config.focus,
      startDate: nb.start,
      endDate: nb.end,
      sessions: weeks.reduce((sum, w) => sum + w.sessions, 0),
      weeks,
    });
  });

  // Free weeks group by the month of the Monday that starts them, so a week
  // never splits across two months.
  const freeByMonth = new Map<string, TrainingLogWeek[]>();
  for (const [monday, dates] of [...freeByMonday].sort(([a], [b]) => a.localeCompare(b))) {
    const week: TrainingLogWeek = {
      weekStart: monday,
      weekEnd: addDaysToDateString(monday, 6),
      sessions: dates.reduce((sum, d) => sum + (sessionsByDate.get(d) ?? 0), 0),
      dates,
      customLabel: customLabel(monday),
    };
    const monthKey = monday.slice(0, 7);
    freeByMonth.set(monthKey, [...(freeByMonth.get(monthKey) ?? []), week]);
  }
  for (const [monthKey, weeks] of freeByMonth) {
    periods.push({
      key: `free:${monthKey}`,
      kind: 'free',
      monthKey,
      monthName: nameByMonth.get(monthKey) || undefined,
      startDate: weeks[0].weekStart,
      endDate: weeks[weeks.length - 1].weekEnd,
      sessions: weeks.reduce((sum, w) => sum + w.sessions, 0),
      weeks,
    });
  }

  // Newest period first; inside a period weeks/days already ascend.
  return periods.sort(
    (a, b) => b.endDate.localeCompare(a.endDate) || b.startDate.localeCompare(a.startDate)
  );
}

// Which day a week's "＋ Ghi buổi" should suggest: the first day of that week
// (Monday first) that is not in the future and has nothing in the log yet. When
// every such day is filled, the latest day up to today (or the week's last day
// for a fully past week) — the user can retype it.
export function suggestEntryDate(week: TrainingLogWeek, today: string): string {
  if (week.weekStart > today) return today; // a future week: nothing there can be logged yet
  const taken = new Set(week.dates);
  let latestAllowed = week.weekStart;
  for (let i = 0; i < 7; i++) {
    const date = addDaysToDateString(week.weekStart, i);
    if (date > today) break;
    latestAllowed = date;
    if (!taken.has(date)) return date;
  }
  return latestAllowed;
}
