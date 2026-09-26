import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  Easing,
  runOnJS,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { cycleTab, swipeStep, type MainTab, type SwipeStep } from './mainTabs';
import { pageOffsets } from './pageOffsets';
import { SLIDE_MS, setPendingDirection } from './slideTransition';
import * as haptics from '../lib/haptics';

// Long horizontal swipe anywhere on a main screen = go to the next / previous
// tab, looping round (Settings → Home and back). The tab bar still works as
// before; this is only a shortcut.
//
// Gesture: a Pan that activates after 25 px sideways and fails on vertical
// movement, so vertical scrolling is untouched. Horizontal scrollers inside a
// screen (supplement chips, date strips, week pagers) start their own pan
// earlier (~10 px) and win, so they keep scrolling as before.
//
// Motion: like a pager — the page follows the finger 1:1 and the real
// neighbouring page (kept mounted by SlideTabNavigator) slides in beside it.
// Release past the threshold and the navigator finishes the slide from where
// the finger left it; a shorter drag springs both pages back.

interface SwipeValues {
  current: SharedValue<number>;
  next: SharedValue<number>;
  prev: SharedValue<number>;
  dragging: SharedValue<boolean>;
}

// The page's long-swipe gesture. The finish logic sits in onFinalize, which
// always runs — finger up or cancelled — so a page can never be left half-way
// across the screen. Outside the component: its callbacks write shared
// values, which the React lint rules don't allow inside a hook callback.
function buildSwipeGesture(
  v: SwipeValues,
  focused: boolean,
  reduceMotion: boolean,
  width: number,
  goTo: (step: SwipeStep) => void
) {
  return Gesture.Pan()
    .enabled(focused)
    .activeOffsetX([-25, 25])
    .failOffsetY([-18, 18])
    .onStart(() => {
      v.dragging.value = true;
    })
    .onUpdate((e) => {
      if (reduceMotion || width <= 0) return;
      const p = e.translationX / width; // < 0 = dragging toward the next tab
      v.current.value = p;
      if (p < 0) {
        v.next.value = 1 + p;
        v.prev.value = -1;
      } else {
        v.prev.value = -1 + p;
        v.next.value = 1;
      }
    })
    .onFinalize((e, success) => {
      if (!v.dragging.value) return;
      v.dragging.value = false;
      const step = success ? swipeStep(e.translationX, e.velocityX, width) : 0;
      if (step !== 0) {
        runOnJS(goTo)(step);
      } else {
        const back = { duration: SLIDE_MS * 0.7, easing: Easing.out(Easing.cubic) };
        v.current.value = withTiming(0, back);
        v.next.value = withTiming(1, back);
        v.prev.value = withTiming(-1, back);
      }
    });
}

function SwipeFrame({ tab, children }: { tab: MainTab; children: React.ReactNode }) {
  const navigation = useNavigation<{ navigate: (name: MainTab) => void }>();
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const current = pageOffsets[tab];
  const next = pageOffsets[cycleTab(tab, 1)];
  const prev = pageOffsets[cycleTab(tab, -1)];

  const goTo = useCallback(
    (step: SwipeStep) => {
      haptics.tapLight();
      setPendingDirection(step);
      navigation.navigate(cycleTab(tab, step));
    },
    [tab, navigation]
  );

  // True only between the drag becoming active and the finger lifting.
  const dragging = useSharedValue(false);

  // Built once per page, not on every render, so an in-flight drag is never
  // dropped (see buildSwipeGesture).
  const pan = useMemo(
    () => buildSwipeGesture({ current, next, prev, dragging }, focused, reduceMotion, width, goTo),
    [current, next, prev, dragging, focused, reduceMotion, width, goTo]
  );

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.root}>{children}</View>
    </GestureDetector>
  );
}

// Wraps a tab screen with the swipe gesture. Called once per tab at module
// level in AppNavigator, so each wrapped component keeps a stable identity.
export function withTabSwipe<P extends object>(Screen: React.ComponentType<P>, tab: MainTab) {
  function TabSwipeScreen(props: P) {
    return (
      <SwipeFrame tab={tab}>
        <Screen {...props} />
      </SwipeFrame>
    );
  }
  TabSwipeScreen.displayName = `TabSwipe(${tab})`;
  return TabSwipeScreen;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
