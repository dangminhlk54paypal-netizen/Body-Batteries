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
    const batteryName = alert.batteryName || 'năng lượng';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚡ Pin ${batteryName} thấp`,
        body: alert.message,
        data: { batteryTypeId: alert.batteryTypeId },
      },
      trigger: null, // show immediately
    });
  }
}

// S-M: neutral "ăn dư" nudge, replacing the old low-battery alert for the
// energy battery (an empty battery in the morning is normal, not a warning).
export async function sendOvereatingAlert(message: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🍽️ Ăn khá đủ hôm nay',
      body: message,
      data: { batteryTypeId: 'energy' },
    },
    trigger: null, // show immediately
  });
}

// S-Q: gentle "maybe eat something" nudge when the satiety reserve has hit
// its floor during waking hours. Deliberately soft wording — a low fullness
// battery is normal (mornings, between meals), never an emergency.
export async function sendEatReminder(message: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🍽️ Nên ăn chút gì nhé',
      body: message,
      data: { batteryTypeId: 'energy' },
    },
    trigger: null, // show immediately
  });
}

export async function scheduleDailyReminder(hour: number, minute: number): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '💪 Body Batteries',
      body: 'Cùng cập nhật năng lượng hôm nay nào!',
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
