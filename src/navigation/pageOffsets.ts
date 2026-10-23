import { makeMutable, type SharedValue } from 'react-native-reanimated';
import { MAIN_TABS, type MainTab } from './mainTabs';

// Live page offset of every tab, in screen widths (see slideTransition.ts).
// Module-level so the long-swipe gesture (TabSwipe.tsx) can drag the current
// page and its neighbour directly, and the navigator finishes from there.
// Home (first tab) starts on screen, the rest just off to the right, until
// placePagesAt() moves the chosen start tab on screen.
export const pageOffsets: Record<MainTab, SharedValue<number>> = Object.fromEntries(
  MAIN_TABS.map((tab, i) => [tab, makeMutable(i === 0 ? 0 : 1)])
) as unknown as Record<MainTab, SharedValue<number>>;

// Put `focused` on screen and every other page just off to the right — run
// once when the navigator mounts on a start tab other than Home.
export function placePagesAt(focused: MainTab): void {
  MAIN_TABS.forEach((tab) => {
    pageOffsets[tab].value = tab === focused ? 0 : 1;
  });
}
