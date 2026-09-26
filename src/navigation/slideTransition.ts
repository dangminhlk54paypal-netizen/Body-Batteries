import type { SwipeStep } from './mainTabs';

// Tab screens slide past each other (SlideTabNavigator.tsx). Every tab has a
// page offset in screen widths: 0 = on screen, +1 = just off to the right,
// -1 = just off to the left. A switch slides the new page in from one side
// while every page still (partly) on screen slides out the other side, so
// a quick scrub across the tab bar reads as pages flowing past.

export const SLIDE_MS = 300;
// Pure planning only; the live per-tab offsets are in pageOffsets.ts.

// A swipe that wraps round (Settings → Home) moves "forward" even though the
// index goes down — it sets the direction here just before navigating.
let pendingDirection: SwipeStep | 0 = 0;
export function setPendingDirection(step: SwipeStep): void {
  pendingDirection = step;
}

// +1 = new page comes in from the right (moving to a tab further right).
export function slideDirection(prevIndex: number, nextIndex: number): SwipeStep {
  const pending = pendingDirection;
  pendingDirection = 0;
  if (pending !== 0) return pending;
  return nextIndex < prevIndex ? -1 : 1;
}

// Where each page starts and ends for a switch to `target`. A page already
// partly on screen (dragged in, or mid-way through the previous switch)
// continues from where it is instead of jumping.
export function slidePlan(
  current: number[],
  target: number,
  direction: SwipeStep
): { start: number[]; end: number[] } {
  const start = current.map((off, i) => (i === target && Math.abs(off) >= 1 ? direction : off));
  const end = current.map((off, i) => (i === target ? 0 : Math.abs(off) < 1 ? -direction : off));
  return { start, end };
}
