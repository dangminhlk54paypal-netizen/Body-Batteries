import * as Haptics from 'expo-haptics';

export function tapLight(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function success(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function warning(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

// Light "tick" for moving between options (e.g. sliding across the tab bar).
export function selection(): void {
  Haptics.selectionAsync().catch(() => {});
}
