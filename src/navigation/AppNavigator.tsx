import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HomeScreen } from '../screens/HomeScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { TrainingScreen } from '../screens/TrainingScreen';
import { DiaryScreen } from '../screens/DiaryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useT } from '../i18n/useT';
import { useThemeColors } from '../hooks/useThemeColors';
import { useSettingsStore } from '../store/settingsStore';
import { AmbientBackground } from '../components/AmbientBackground';
import { MAIN_TABS, MAIN_TAB_META, resolveStartTab, type MainTab } from './mainTabs';
import { withTabSwipe } from './TabSwipe';
import { createSlideTabNavigator } from './SlideTabNavigator';
import { BubbleTabBar } from './BubbleTabBar';

// Our own tab navigator: pages slide past each other on every switch
// (SlideTabNavigator.tsx).
const Tab = createSlideTabNavigator();

// Each screen wrapped once, at module level, with the long-swipe gesture that
// loops through the tabs (TabSwipe.tsx) — stable identities, so React
// Navigation never remounts a screen.
const SCREENS: Record<MainTab, React.ComponentType> = {
  Home: withTabSwipe(HomeScreen, 'Home'),
  History: withTabSwipe(HistoryScreen, 'History'),
  Training: withTabSwipe(TrainingScreen, 'Training'),
  Diary: withTabSwipe(DiaryScreen, 'Diary'),
  Settings: withTabSwipe(SettingsScreen, 'Settings'),
};

export function AppNavigator() {
  // useT() subscribes to the language slice, so this re-renders (and
  // re-reads the tab labels below) whenever the user switches language —
  // React Navigation's `options` are plain values re-evaluated every render.
  const { t } = useT();
  const c = useThemeColors();
  // The tab the app opens on (Settings → Giao diện). Read once: changing it
  // applies from the next launch, never yanks the user off the current tab.
  const [startTab] = useState(() => resolveStartTab(useSettingsStore.getState().startTab));
  return (
    // The ambient glow sits behind every page (screens go see-through while
    // it is on — useScreenBackground), so it stays put as pages slide past.
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <AmbientBackground />
      <Tab.Navigator
        initialRouteName={startTab}
        // Custom bar: slide a finger along it and the icons bubble up in a wave
        // that follows the finger, switching tabs as it passes (BubbleTabBar.tsx).
        tabBar={(props) => <BubbleTabBar {...props} />}
      >
        {MAIN_TABS.map((tab) => (
          <Tab.Screen
            key={tab}
            name={tab}
            component={SCREENS[tab]}
            options={{
              tabBarLabel: t(MAIN_TAB_META[tab].labelKey),
            }}
          />
        ))}
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
