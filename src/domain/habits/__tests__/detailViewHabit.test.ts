import {
  addOpenEvent,
  openLimit,
  suggestViewMode,
  toggleOpen,
  QUICK_SWITCH_MS,
  SNOOZE_MS,
  type DetailOpenEvent,
} from '../detailViewHabit';

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date(2026, 8, 20, 9, 0, 0).getTime();

function ev(id: string, at: number, mode: DetailOpenEvent['mode'] = 'single', openCount = 1): DetailOpenEvent {
  return { id, at, mode, openCount };
}

describe('toggleOpen', () => {
  it('keeps one row in one-row mode', () => {
    expect(toggleOpen(['meals'], 'activities', openLimit('single'))).toEqual(['activities']);
  });

  it('keeps up to three, folding the one opened longest ago', () => {
    let open: string[] = [];
    for (const id of ['meals', 'activities', 'balance', 'micro']) open = toggleOpen(open, id, openLimit('multi'));
    expect(open).toEqual(['activities', 'balance', 'micro']);
  });

  it('closes an open row', () => {
    expect(toggleOpen(['meals', 'activities'], 'meals', 3)).toEqual(['activities']);
  });
});

describe('suggestViewMode — one-row mode', () => {
  // A "quick switch": open meals, then activities a few seconds later.
  const pair = (at: number) => [ev('meals', at), ev('activities', at + 5_000)];

  it('suggests multi view after quick switches on two different days', () => {
    const log = [...pair(T0), ...pair(T0 + 60_000), ...pair(T0 + DAY)];
    expect(suggestViewMode(log, 'single', T0 + DAY + 10_000, 0)).toBe('multi');
  });

  it('does not suggest from one curious burst on a single day', () => {
    const log = [...pair(T0), ...pair(T0 + 60_000), ...pair(T0 + 120_000), ...pair(T0 + 180_000)];
    expect(suggestViewMode(log, 'single', T0 + 200_000, 0)).toBeNull();
  });

  it('ignores slow, unrelated opens', () => {
    const log = [ev('meals', T0), ev('activities', T0 + QUICK_SWITCH_MS + 1), ev('meals', T0 + DAY), ev('micro', T0 + DAY + 60_000)];
    expect(suggestViewMode(log, 'single', T0 + DAY + 70_000, 0)).toBeNull();
  });

  it('stays quiet while snoozed', () => {
    const log = [...pair(T0), ...pair(T0 + 60_000), ...pair(T0 + DAY)];
    const now = T0 + DAY + 10_000;
    expect(suggestViewMode(log, 'single', now, now + SNOOZE_MS)).toBeNull();
  });
});

describe('suggestViewMode — multi view', () => {
  it('suggests one row again when ten opens across two days never had two rows open', () => {
    const log = Array.from({ length: 10 }, (_, i) => ev('meals', T0 + i * (DAY / 5), 'multi', 1));
    expect(suggestViewMode(log, 'multi', T0 + 2 * DAY + 1, 0)).toBe('single');
  });

  it('keeps multi view when the user really uses it', () => {
    const log = Array.from({ length: 10 }, (_, i) => ev('meals', T0 + i * (DAY / 5), 'multi', i === 4 ? 2 : 1));
    expect(suggestViewMode(log, 'multi', T0 + 2 * DAY + 1, 0)).toBeNull();
  });
});

describe('addOpenEvent', () => {
  it('drops events older than two weeks', () => {
    const log = addOpenEvent([ev('meals', T0)], ev('micro', T0 + 15 * DAY));
    expect(log.map((e) => e.id)).toEqual(['micro']);
  });
});
