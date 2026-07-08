// Web stub: expo-notifications không hỗ trợ trên trình duyệt web.
// File này được Metro tự động chọn thay cho notificationService.ts khi build cho web.

import type { BatteryAlert } from '../../domain/rules/lowBatteryRules';

export async function requestNotificationPermission(): Promise<boolean> {
  console.warn('Notifications are not available on web');
  return false;
}

export async function sendLowBatteryAlerts(_alerts: BatteryAlert[]): Promise<void> {
  console.warn('Notifications are not available on web');
}

export async function sendOvereatingAlert(_message: string): Promise<void> {
  console.warn('Notifications are not available on web');
}

export async function sendEatReminder(_message: string): Promise<void> {
  console.warn('Notifications are not available on web');
}

export async function scheduleDailyReminder(_hour: number, _minute: number): Promise<string> {
  console.warn('Notifications are not available on web');
  return '';
}

export async function cancelAllNotifications(): Promise<void> {
  console.warn('Notifications are not available on web');
}
