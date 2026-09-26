import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, AppState, Appearance, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation/AppNavigator';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { useDrainTick } from './src/hooks/useDrainTick';
import { useBlockSessionAutoLog } from './src/hooks/useBlockSessionAutoLog';
import { useEnergyStore } from './src/store/energyStore';
import { useSettingsStore } from './src/store/settingsStore';
import { todayString, energyDayString } from './src/lib/dateUtils';
import { checkDateChanged } from './src/services/background/dailyResetCheck';
import { appDarkNavigationTheme, appLightNavigationTheme } from './src/navigation/navigationThemes';
import { useResolvedThemeMode } from './src/hooks/useThemeColors';

// How often to check for a calendar-day rollover while the app stays open.
const DATE_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentMode = useSettingsStore((s) => s.currentMode);
  const hasOnboarded = useSettingsStore((s) => s.hasOnboarded);
  const setHasOnboarded = useSettingsStore((s) => s.setHasOnboarded);
  const themeMode = useResolvedThemeMode();
  const themeSetting = useSettingsStore((s) => s.themeMode);

  // app.json lets iOS follow the phone (userInterfaceStyle "automatic") so
  // the 'system' option works; an explicit Dark/Light choice is pushed back
  // to iOS so native alerts and the keyboard match the app, not the phone.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Appearance.setColorScheme(themeSetting === 'system' ? 'unspecified' : themeSetting);
  }, [themeSetting]);

  useEffect(() => {
    async function bootstrap() {
      try {
        if (Platform.OS !== 'web') {
          // Native-only: SQLite & Notifications không chạy được trên web
          const { initDatabase } = await import('./src/data/db/database');
          const { requestNotificationPermission } = await import('./src/services/notifications/notificationService');
          const { loadCustomFoodsIntoRegistry } = await import('./src/data/food/customFoodRegistry');
          const { loadOverridesIntoRegistry } = await import('./src/data/food/foodOverrideRegistry');
          await initDatabase();
          await requestNotificationPermission();
          // Hydrate the custom-foods search/lookup registry (see
          // customFoodRegistry.ts). Defensive internally — never throws.
          await loadCustomFoodsIntoRegistry();
          // Hydrate the food-override registry (user-corrected nutrition that
          // shadows the catalog at lookup time — see foodOverrideRegistry.ts).
          // Defensive internally — never throws.
          await loadOverridesIntoRegistry();
          // One-time online re-check of old machine-translated food names
          // (no-op unless auto-translate is on). Not awaited: never delays startup.
          import('./src/services/translation/foodNameTranslationService').then((m) =>
            m.recheckStoredFoodTranslations()
          );
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
  // Confirmed block sessions go into Xả when their time comes.
  useBlockSessionAutoLog(ready);

  // Detect a day rollover while the app stays open (e.g. left running
  // overnight) and reload the battery readings. Two independent boundaries:
  // midnight rolls the calendar day (nutrient batteries), 6am rolls the
  // "energy day" (the calorie ledger — S-Q reset).
  useEffect(() => {
    if (!ready) return;

    let lastDate = todayString();
    let lastEnergyDay = energyDayString();

    const checkForNewDay = () => {
      const newDate = checkDateChanged(lastDate);
      if (newDate) lastDate = newDate;

      const newEnergyDay = energyDayString();
      const energyDayChanged = newEnergyDay !== lastEnergyDay;
      lastEnergyDay = newEnergyDay;

      if (newDate || energyDayChanged) {
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

  // Once per calendar month: auto-export the previous month's workbook to the
  // app document folder, then ASK (never silently) whether to clear old data.
  // Fully defensive — maybeRunMonthlyExport swallows its own errors.
  useEffect(() => {
    if (!ready || Platform.OS === 'web') return;
    (async () => {
      const { maybeRunMonthlyExport, confirmAndCleanupAfterExport } = await import(
        './src/services/export/monthlyAutoExport'
      );
      const res = await maybeRunMonthlyExport();
      if (res.ran && res.filename) confirmAndCleanupAfterExport(res.filename);
    })();
  }, [ready]);

  let content: React.ReactNode;
  if (error) {
    content = (
      <View style={styles.center}>
        <Text style={styles.errorText}>Khởi động thất bại: {error}</Text>
      </View>
    );
  } else if (!ready) {
    content = (
      <View style={styles.center}>
        <Text style={styles.loadingText}>⚡ Đang khởi động Body Batteries...</Text>
      </View>
    );
  } else if (!hasOnboarded) {
    content = <OnboardingScreen onDone={() => setHasOnboarded(true)} />;
  } else {
    content = (
      <NavigationContainer
        theme={themeMode === 'light' ? appLightNavigationTheme : appDarkNavigationTheme}
      >
        <AppNavigator />
      </NavigationContainer>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      {content}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
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
