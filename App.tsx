import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, AppState, type AppStateStatus } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { useDrainTick } from './src/hooks/useDrainTick';
import { useEnergyStore } from './src/store/energyStore';
import { useSettingsStore } from './src/store/settingsStore';
import { todayString } from './src/lib/dateUtils';
import { checkDateChanged } from './src/services/background/dailyResetCheck';

// How often to check for a calendar-day rollover while the app stays open.
const DATE_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentMode = useSettingsStore((s) => s.currentMode);
  const hasOnboarded = useSettingsStore((s) => s.hasOnboarded);
  const setHasOnboarded = useSettingsStore((s) => s.setHasOnboarded);

  useEffect(() => {
    async function bootstrap() {
      try {
        if (Platform.OS !== 'web') {
          // Native-only: SQLite & Notifications không chạy được trên web
          const { initDatabase } = await import('./src/data/db/database');
          const { requestNotificationPermission } = await import('./src/services/notifications/notificationService');
          await initDatabase();
          await requestNotificationPermission();
        }
        setReady(true);
      } catch (e) {
        setError(String(e));
      }
    }
    bootstrap();
  }, []);

  // Phase 2: apply foreground battery drain over elapsed time.
  useDrainTick(currentMode, ready);

  // Detect a calendar-day rollover while the app stays open (e.g. left
  // running overnight) and reload today's battery readings for the new day.
  useEffect(() => {
    if (!ready) return;

    let lastDate = todayString();

    const checkForNewDay = () => {
      const newDate = checkDateChanged(lastDate);
      if (newDate) {
        lastDate = newDate;
        useEnergyStore.getState().loadToday(useSettingsStore.getState().currentMode);
      }
    };

    const interval = setInterval(checkForNewDay, DATE_CHECK_INTERVAL_MS);
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') checkForNewDay();
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [ready]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Khởi động thất bại: {error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>⚡ Đang khởi động Body Batteries...</Text>
      </View>
    );
  }

  if (!hasOnboarded) {
    return <OnboardingScreen onDone={() => setHasOnboarded(true)} />;
  }

  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#0d0d1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#aaa',
    fontSize: 16,
  },
  errorText: {
    color: '#FF4757',
    fontSize: 14,
    textAlign: 'center',
  },
});
