import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
