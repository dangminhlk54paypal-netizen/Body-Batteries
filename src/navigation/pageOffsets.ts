import { makeMutable, type SharedValue } from 'react-native-reanimated';
import { MAIN_TABS, type MainTab } from './mainTabs';

// Live page offset of every tab, in screen widths (see slideTransition.ts).
// Module-level so the long-swipe gesture (TabSwipe.tsx) can drag the current
// page and its neighbour directly, and the navigator finishes from there.
// Home (first tab) starts on screen, the rest just off to the right.
export const pageOffsets: Record<MainTab, SharedValue<number>> = Object.fromEntries(
  MAIN_TABS.map((tab, i) => [tab, makeMutable(i === 0 ? 0 : 1)])
) as unknown as Record<MainTab, SharedValue<number>>;
