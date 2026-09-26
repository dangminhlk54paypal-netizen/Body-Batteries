// The five bottom tabs, in the order they appear — also the order a long
// horizontal swipe walks through them (TabSwipe.tsx). Swiping past the last
// tab wraps to the first, so the tabs form a loop in both directions.
export const MAIN_TABS = ['Home', 'History', 'Training', 'Diary', 'Settings'] as const;
export type MainTab = (typeof MAIN_TABS)[number];

// Tab-bar icon + label key, shared by the tab bar and the swipe peek pills.
export const MAIN_TAB_META: Record<MainTab, { icon: string; labelKey: string }> = {
  Home: { icon: '⚡', labelKey: 'nav.home' },
  History: { icon: '📊', labelKey: 'nav.history' },
  Training: { icon: '🏋️', labelKey: 'nav.training' },
  Diary: { icon: '📔', labelKey: 'nav.diary' },
  Settings: { icon: '⚙️', labelKey: 'nav.settings' },
};

export type SwipeStep = 1 | -1; // +1 = next tab (swipe left), -1 = previous (swipe right)

export function cycleTab(current: MainTab, step: SwipeStep): MainTab {
  const i = MAIN_TABS.indexOf(current);
  const n = MAIN_TABS.length;
  return MAIN_TABS[(((i + step) % n) + n) % n];
}

// How far a finger must travel before a release switches tabs: a long drag
// (≥ 30 % of the screen), or a quick flick that still covers ≥ 12 %. Shorter
// or slower drags snap back, so reading gestures never flip the page.
export const SWIPE_DISTANCE_RATIO = 0.3;
export const FLICK_DISTANCE_RATIO = 0.12;
export const FLICK_VELOCITY = 800; // px/s

// Runs on the UI thread at gesture end (hence 'worklet'); plain JS in tests.
export function swipeStep(translationX: number, velocityX: number, width: number): SwipeStep | 0 {
  'worklet';
  const distance = Math.abs(translationX);
  const long = distance >= width * SWIPE_DISTANCE_RATIO;
  const flick = distance >= width * FLICK_DISTANCE_RATIO && Math.abs(velocityX) >= FLICK_VELOCITY;
  // A flick back toward the start cancels even a long drag.
  const sameWay = Math.sign(velocityX) !== -Math.sign(translationX) || Math.abs(velocityX) < FLICK_VELOCITY;
  if (!(long || flick) || !sameWay) return 0;
  return translationX < 0 ? 1 : -1;
}
