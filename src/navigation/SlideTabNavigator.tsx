import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import {
  createNavigatorFactory,
  TabRouter,
  useNavigationBuilder,
  type DefaultNavigatorOptions,
  type NavigationHelpers,
  type ParamListBase,
  type TabActionHelpers,
  type TabNavigationState,
  type TabRouterOptions,
} from '@react-navigation/native';
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, withTiming, type SharedValue } from 'react-native-reanimated';
import { cycleTab, type MainTab } from './mainTabs';
import { pageOffsets } from './pageOffsets';
import { SLIDE_MS, slideDirection, slidePlan } from './slideTransition';

// A small tab navigator of our own (React Navigation's TabRouter + builder,
// no extra library) whose screens slide past each other: the new tab's page
// glides in from one side while the old one glides out the other, instead of
// the instant swap @react-navigation/bottom-tabs v6 does (it hides the old
// screen immediately, so no transition is possible there).
//
// Pages stay mounted once visited (same as bottom-tabs), and the focused
// tab's two neighbours are mounted too, so a long swipe (TabSwipe.tsx) shows
// the real next page following the finger.

export interface SlideTabOptions {
  tabBarLabel?: string;
}

export type SlideTabEventMap = {
  tabPress: { data: undefined; canPreventDefault: true };
};

export interface SlideTabBarProps {
  state: TabNavigationState<ParamListBase>;
  descriptors: Record<string, { options: SlideTabOptions }>;
  navigation: NavigationHelpers<ParamListBase, SlideTabEventMap>;
  insets: EdgeInsets;
}

type Props = DefaultNavigatorOptions<
  ParamListBase,
  TabNavigationState<ParamListBase>,
  SlideTabOptions,
  SlideTabEventMap
> &
  TabRouterOptions & {
    tabBar: (props: SlideTabBarProps) => React.ReactNode;
  };

const EASING = Easing.out(Easing.cubic);

function SlideTabNavigator({ initialRouteName, backBehavior, children, screenOptions, tabBar }: Props) {
  const { state, navigation, descriptors, NavigationContent } = useNavigationBuilder<
    TabNavigationState<ParamListBase>,
    TabRouterOptions,
    TabActionHelpers<ParamListBase>,
    SlideTabOptions,
    SlideTabEventMap
  >(TabRouter, { children, screenOptions, initialRouteName, backBehavior });

  const reduceMotion = useReducedMotion();
  const focusedName = state.routes[state.index].name as MainTab;

  // Mounted pages: every tab visited so far plus the focused tab's neighbours.
  // Adjusted during render (React's "state from props" pattern), never shrinks.
  const [mounted, setMounted] = useState<string[]>([]);
  const wanted = [focusedName, cycleTab(focusedName, 1), cycleTab(focusedName, -1)];
  if (wanted.some((name) => !mounted.includes(name))) {
    setMounted([...new Set([...mounted, ...wanted])]);
  }

  // Slide on every tab change (tab bar tap/scrub, long swipe, navigate()).
  const prevIndex = useRef(state.index);
  useEffect(() => {
    const from = prevIndex.current;
    const to = state.index;
    prevIndex.current = to;
    if (from === to) return;
    const names = state.routes.map((r) => r.name as MainTab);
    const direction = slideDirection(from, to);
    const current = names.map((n) => pageOffsets[n].value);
    const { start, end } = slidePlan(current, to, direction);
    names.forEach((n, i) => {
      const offset = pageOffsets[n];
      if (reduceMotion) {
        offset.value = end[i];
        return;
      }
      // Only the incoming page may jump (to just off-screen); a page already
      // moving keeps its live UI-thread position so a fast scrub never hitches.
      if (start[i] !== current[i]) offset.value = start[i];
      if (end[i] !== current[i] || start[i] !== current[i]) {
        offset.value = withTiming(end[i], { duration: SLIDE_MS, easing: EASING });
      }
    });
  }, [state.index, state.routes, reduceMotion]);

  return (
    <NavigationContent>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <View style={styles.root}>
          <View style={styles.scenes}>
            {state.routes.map((route, index) => {
              if (!mounted.includes(route.name)) return null;
              return (
                <SlideScene key={route.key} offset={pageOffsets[route.name as MainTab]} focused={index === state.index}>
                  {descriptors[route.key].render()}
                </SlideScene>
              );
            })}
          </View>
          <TabBarHost tabBar={tabBar} state={state} descriptors={descriptors} navigation={navigation} />
        </View>
      </SafeAreaProvider>
    </NavigationContent>
  );
}

function SlideScene({
  offset,
  focused,
  children,
}: {
  offset: SharedValue<number>;
  focused: boolean;
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value * width }] }));
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents={focused ? 'auto' : 'none'}
      // Off-screen pages stay mounted but must not be read by VoiceOver.
      accessibilityElementsHidden={!focused}
      importantForAccessibility={focused ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </Animated.View>
  );
}

// Inside the SafeAreaProvider so the bar gets the real bottom inset.
function TabBarHost({
  tabBar,
  state,
  descriptors,
  navigation,
}: Omit<SlideTabBarProps, 'insets'> & { tabBar: Props['tabBar'] }) {
  const insets = useSafeAreaInsets();
  return <>{tabBar({ state, descriptors, navigation, insets })}</>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scenes: { flex: 1, overflow: 'hidden' },
});

export const createSlideTabNavigator = createNavigatorFactory<
  TabNavigationState<ParamListBase>,
  SlideTabOptions,
  SlideTabEventMap,
  typeof SlideTabNavigator
>(SlideTabNavigator);

