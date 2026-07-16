import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { HomeScreen } from '../screens/HomeScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { DiaryScreen } from '../screens/DiaryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors } from '../lib/theme';
import { useT } from '../i18n/useT';

const Tab = createBottomTabNavigator();

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export function AppNavigator() {
  // useT() subscribes to the language slice, so this re-renders (and
  // re-reads the tab labels below) whenever the user switches language —
  // React Navigation's `options` are plain values re-evaluated every render.
  const { t } = useT();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.bgElevated,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t('nav.home'),
          tabBarIcon: () => <TabIcon emoji="⚡" />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: t('nav.history'),
          tabBarIcon: () => <TabIcon emoji="📊" />,
        }}
      />
      <Tab.Screen
        name="Diary"
        component={DiaryScreen}
        options={{
          tabBarLabel: t('nav.diary'),
          tabBarIcon: () => <TabIcon emoji="📔" />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: t('nav.settings'),
          tabBarIcon: () => <TabIcon emoji="⚙️" />,
        }}
      />
    </Tab.Navigator>
  );
}
