import * as Notifications from 'expo-notifications';
import type { BatteryAlert } from '../../domain/rules/lowBatteryRules';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function sendLowBatteryAlerts(alerts: BatteryAlert[]): Promise<void> {
  for (const alert of alerts) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚡ Pin năng lượng thấp',
        body: alert.message,
        data: { batteryTypeId: alert.batteryTypeId },
      },
      trigger: null, // show immediately
    });
  }
}

export async function scheduleDailyReminder(hour: number, minute: number): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '💪 Body Batteries',
      body: 'Đừng quên cập nhật năng lượng hôm nay!',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  return id;
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
