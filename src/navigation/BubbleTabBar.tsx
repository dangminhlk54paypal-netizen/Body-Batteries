import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import type { SlideTabBarProps } from './SlideTabNavigator';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { MAIN_TAB_META, type MainTab } from './mainTabs';
import { bubbleInfluence, tabCenterX, tabIndexAt } from './bubbleWave';
import type { ThemeColors } from '../lib/theme';
import { useThemeColors, useThemedStyles } from '../hooks/useThemeColors';
import * as haptics from '../lib/haptics';

// Bottom tab bar with a "bubble wave": put a finger on the bar and slide
// left/right — the icons swell into bubbles and lift along a smooth curve that
// follows the finger (like the macOS Dock), and the tab under the finger opens
// right away with a light haptic tick. Release and the bubbles settle back.
// A plain tap still just opens that tab. "Reduce motion" keeps the switching
// but drops the lift/swell.

const BAR_HEIGHT = 52;
const LIFT = 22; // px the bubble right under the finger rises
const SWELL = 0.5; // extra scale under the finger (1 → 1.5)
const BUBBLE = 40; // bubble circle diameter
const SPRING = { damping: 16, stiffness: 220, mass: 0.6 }; // rising only
const SETTLE_MS = 180;

// Fixed forwarder the gesture calls (see the comment on selectTab below).
let tabSelectHandler: ((index: number) => void) | null = null;
function selectFromGesture(index: number): void {
  tabSelectHandler?.(index);
}

export function BubbleTabBar({ state, descriptors, navigation, insets }: SlideTabBarProps) {
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReducedMotion();
  const count = state.routes.length;
  const fingerX = useSharedValue(0);
  const active = useSharedValue(0); // 0 = resting, 1 = finger down (wave up)
  const barWidth = useSharedValue(0);
  const lastIndex = useSharedValue(-1);

  // The gesture must be built once: each tab switch mid-scrub re-renders the
  // bar, and a rebuilt gesture drops the in-flight touch, so its "finger up"
  // never arrives and the bubbles stay lifted. `navigation` itself changes
  // identity on every switch, so the gesture calls a fixed forwarder that
  // always reaches the latest selectTab (there is only one tab bar).
  const selectTab = useCallback(
    (index: number) => {
      const live = navigation.getState();
      const route = live.routes[index];
      if (!route) return;
      const focused = live.index === index;
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        haptics.selection();
        navigation.navigate(route.name, route.params);
      }
    },
    [navigation]
  );
  useEffect(() => {
    tabSelectHandler = selectTab;
  }, [selectTab]);

  const pan = useMemo(
    () => buildScrubGesture({ fingerX, active, barWidth, lastIndex }, count, reduceMotion, selectFromGesture),
    [fingerX, active, barWidth, lastIndex, count, reduceMotion]
  );

  function onLayout(e: LayoutChangeEvent) {
    setShared(barWidth, e.nativeEvent.layout.width);
  }

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: BAR_HEIGHT + insets.bottom }]}>
      <GestureDetector gesture={pan}>
        <View style={styles.row} onLayout={onLayout}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : route.name;
            const meta = MAIN_TAB_META[route.name as MainTab];
            return (
              <BubbleItem
                key={route.key}
                index={index}
                count={count}
                icon={meta?.icon ?? '•'}
                label={label}
                focused={state.index === index}
                fingerX={fingerX}
                active={active}
                barWidth={barWidth}
                onActivate={() => selectTab(index)}
              />
            );
          })}
        </View>
      </GestureDetector>
    </View>
  );
}

// Outside the component for the same lint reason as buildScrubGesture.
function setShared(v: SharedValue<number>, value: number): void {
  v.value = value;
}

interface ScrubValues {
  fingerX: SharedValue<number>;
  active: SharedValue<number>;
  barWidth: SharedValue<number>;
  lastIndex: SharedValue<number>;
}

// Finger gone: glide the hump to the chosen tab's centre and sink it — a short
// timing (no spring tail), so it reads as "down right away".
function settleBubbles(v: ScrubValues, count: number): void {
  'worklet';
  if (v.lastIndex.value === -1) return; // already settling (touch-up and end both call this)
  v.lastIndex.value = -1;
  const w = v.barWidth.value;
  v.fingerX.value = withTiming(tabCenterX(tabIndexAt(v.fingerX.value, w, count), w, count), { duration: SETTLE_MS });
  v.active.value = withTiming(0, { duration: SETTLE_MS, easing: Easing.out(Easing.quad) });
}

// The bar's scrub gesture, built once (see selectTab above). Lives outside the
// component: its callbacks write shared values, which the React lint rules
// don't allow inside a hook callback.
function buildScrubGesture(
  v: ScrubValues,
  count: number,
  reduceMotion: boolean,
  selectTab: (index: number) => void
) {
  return Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      v.fingerX.value = e.x;
      v.active.value = reduceMotion ? 0 : withSpring(1, SPRING);
      const i = tabIndexAt(e.x, v.barWidth.value, count);
      v.lastIndex.value = i;
      runOnJS(selectTab)(i);
    })
    .onUpdate((e) => {
      v.fingerX.value = e.x;
      const i = tabIndexAt(e.x, v.barWidth.value, count);
      if (i !== v.lastIndex.value) {
        v.lastIndex.value = i;
        runOnJS(selectTab)(i);
      }
    })
    // Settle on the raw "finger lifted" touch event as well as on the
    // gesture's end: the touch event arrives the instant the finger leaves,
    // whatever state the recognizer is in, so the bubbles never wait.
    .onTouchesUp((e) => {
      if (e.numberOfTouches === 0) settleBubbles(v, count);
    })
    .onTouchesCancelled(() => settleBubbles(v, count))
    .onFinalize(() => settleBubbles(v, count));
}

// How strongly tab `index` is lifted (0..1), from plain numbers.
function liftAmount(fingerX: number, active: number, barWidth: number, index: number, count: number): number {
  'worklet';
  if (barWidth <= 0 || count <= 0) return 0;
  const d = Math.abs(fingerX - tabCenterX(index, barWidth, count));
  return bubbleInfluence(d, barWidth / count) * active;
}

function BubbleItem({
  index,
  count,
  icon,
  label,
  focused,
  fingerX,
  active,
  barWidth,
  onActivate,
}: {
  index: number;
  count: number;
  icon: string;
  label: string;
  focused: boolean;
  fingerX: SharedValue<number>;
  active: SharedValue<number>;
  barWidth: SharedValue<number>;
  onActivate: () => void;
}) {
  const c = useThemeColors();
  const styles = useThemedStyles(createStyles);

  // Each style reads the shared values DIRECTLY: Reanimated only re-runs a
  // style when a shared value it can see in the updater's own closure changes.
  // Reading them through a helper closure (`lift()`) hid them, so the style
  // only refreshed on React re-renders — the bubbles froze lifted after the
  // finger left, until the next touch re-rendered the bar.
  const iconStyle = useAnimatedStyle(() => {
    const k = liftAmount(fingerX.value, active.value, barWidth.value, index, count);
    return { transform: [{ translateY: -LIFT * k }, { scale: 1 + SWELL * k }] };
  });
  const bubbleStyle = useAnimatedStyle(() => {
    const k = liftAmount(fingerX.value, active.value, barWidth.value, index, count);
    return { opacity: k * 0.95, transform: [{ scale: 0.6 + 0.4 * k }] };
  });
  const labelStyle = useAnimatedStyle(() => ({
    opacity: 1 - 0.7 * liftAmount(fingerX.value, active.value, barWidth.value, index, count),
  }));

  return (
    <View
      style={styles.item}
      accessible
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onAccessibilityTap={onActivate}
    >
      <Animated.View style={iconStyle}>
        <Animated.View style={[styles.bubble, focused && styles.bubbleFocused, bubbleStyle]} />
        <View style={styles.iconBox}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
      </Animated.View>
      <Animated.Text
        style={[styles.label, { color: focused ? c.accent : c.textFaint }, labelStyle]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    bar: {
      backgroundColor: c.bgCard,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.bgElevated,
      // Lifted bubbles rise above the bar's top edge.
      overflow: 'visible',
      zIndex: 10,
    },
    row: { flex: 1, flexDirection: 'row', overflow: 'visible' },
    item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, overflow: 'visible' },
    iconBox: { width: BUBBLE, height: 26, alignItems: 'center', justifyContent: 'center' },
    icon: { fontSize: 20 },
    bubble: {
      position: 'absolute',
      left: 0,
      top: 13 - BUBBLE / 2,
      width: BUBBLE,
      height: BUBBLE,
      borderRadius: BUBBLE / 2,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    bubbleFocused: { borderColor: c.accent, borderWidth: 1.5 },
    label: { fontSize: 11, fontWeight: '600' },
  });
