import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useSettingsStore } from '../store/settingsStore';
import { BodyProfileCard } from '../components/BodyProfileCard';
import { exportWeeklyData } from '../services/export/excelExportService';
import { runWeeklyCleanup } from '../services/cleanup/cleanupService';
import {
  requestNotificationPermission,
  scheduleDailyReminder,
  cancelAllNotifications,
} from '../services/notifications/notificationService';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function SettingsScreen() {
  const {
    notificationsEnabled,
    setNotificationsEnabled,
    lowBatteryThreshold,
    setLowBatteryThreshold,
    reminderHour,
    reminderMinute,
    setReminderTime,
  } = useSettingsStore();

  const [exporting, setExporting] = useState(false);

  // Keep the OS-scheduled reminder in sync with the persisted setting,
  // since the reminder is registered with the OS and survives across
  // app restarts until explicitly cancelled.
  useEffect(() => {
    if (notificationsEnabled) {
      applyReminderSchedule(reminderHour, reminderMinute);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyReminderSchedule(hour: number, minute: number) {
    await cancelAllNotifications();
    await scheduleDailyReminder(hour, minute);
  }

  async function handleToggleNotifications(enabled: boolean) {
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          'Thiếu quyền thông báo',
          'Hãy vào Cài đặt của điện thoại → cấp quyền thông báo cho app này, rồi bật lại.'
        );
        return;
      }
      setNotificationsEnabled(true);
      await applyReminderSchedule(reminderHour, reminderMinute);
    } else {
      setNotificationsEnabled(false);
      await cancelAllNotifications();
    }
  }

  async function handleReminderHourChange(delta: number) {
    const newHour = (reminderHour + delta + 24) % 24;
    setReminderTime(newHour, reminderMinute);
    if (notificationsEnabled) {
      await applyReminderSchedule(newHour, reminderMinute);
    }
  }

  async function handleReminderMinuteChange(delta: number) {
    const newMinute = (reminderMinute + delta + 60) % 60;
    setReminderTime(reminderHour, newMinute);
    if (notificationsEnabled) {
      await applyReminderSchedule(reminderHour, newMinute);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportWeeklyData();
    } catch {
      Alert.alert('Lỗi', 'Không thể xuất file. Thử lại sau.');
    } finally {
      setExporting(false);
    }
  }

  function handleCleanup() {
    Alert.alert(
      'Xoá dữ liệu cũ',
      'Dữ liệu hơn 7 ngày sẽ bị xoá VĨNH VIỄN và không thể khôi phục.\n\nHãy bấm "Xuất Excel" trước để giữ lại bản lưu. Bạn có chắc muốn xoá?',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá vĩnh viễn',
          style: 'destructive',
          onPress: () => runWeeklyCleanup(),
        },
      ]
    );
  }

  const thresholdOptions = [0.1, 0.2, 0.3];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Cài đặt</Text>

        {/* Body profile — sizes the energy battery (TDEE) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HỒ SƠ CƠ THỂ</Text>
          <Text style={styles.sectionDesc}>
            Dùng để tính nhu cầu năng lượng (pin Năng lượng). Chỉ tham khảo — không phải tư vấn y tế.
          </Text>
          <BodyProfileCard />
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>THÔNG BÁO</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Bật thông báo</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ true: '#00B894' }}
            />
          </View>

          <Text style={styles.sectionDesc}>
            Giờ nhắc nhở cập nhật năng lượng mỗi ngày
          </Text>
          <View style={styles.timeRow}>
            <View style={styles.stepperGroup}>
              <Pressable
                style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
                onPress={() => handleReminderHourChange(-1)}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </Pressable>
              <Text style={styles.timeValue}>{pad(reminderHour)}</Text>
              <Pressable
                style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
                onPress={() => handleReminderHourChange(1)}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>
            <Text style={styles.timeColon}>:</Text>
            <View style={styles.stepperGroup}>
              <Pressable
                style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
                onPress={() => handleReminderMinuteChange(-15)}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </Pressable>
              <Text style={styles.timeValue}>{pad(reminderMinute)}</Text>
              <Pressable
                style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
                onPress={() => handleReminderMinuteChange(15)}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Low battery threshold */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NGƯỠNG PIN THẤP</Text>
          <Text style={styles.sectionDesc}>
            Nhận thông báo khi pin xuống dưới mức này
          </Text>
          <View style={styles.chipRow}>
            {thresholdOptions.map((t) => (
              <Pressable
                key={t}
                onPress={() => setLowBatteryThreshold(t)}
                style={({ pressed }) => [
                  styles.chip,
                  lowBatteryThreshold === t && styles.chipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    lowBatteryThreshold === t && styles.chipTextActive,
                  ]}
                >
                  {Math.round(t * 100)}%
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Data actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DỮ LIỆU</Text>

          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            onPress={handleExport}
            disabled={exporting}
          >
            <Text style={styles.actionBtnText}>
              {exporting ? 'Đang xuất...' : '📊 Xuất Excel 7 ngày gần nhất'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.dangerBtn, pressed && styles.pressed]}
            onPress={handleCleanup}
          >
            <Text style={[styles.actionBtnText, styles.dangerText]}>
              🗑️ Xoá dữ liệu cũ hơn 7 ngày
            </Text>
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>
          ⚠️ App này chỉ để tham khảo cá nhân — không phải thiết bị y tế.
          Hãy gặp chuyên gia y tế trước khi thay đổi chế độ dinh dưỡng.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  scroll: { padding: 20, gap: 24, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 1.5 },
  sectionDesc: { fontSize: 13, color: '#666' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 12,
  },
  rowLabel: { fontSize: 15, color: '#fff' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  chipActive: { backgroundColor: '#00B894', borderColor: '#00B894' },
  chipText: { color: '#aaa', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 12,
  },
  stepperGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#26263d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  timeValue: { color: '#fff', fontSize: 20, fontWeight: '700', minWidth: 28, textAlign: 'center' },
  timeColon: { color: '#fff', fontSize: 20, fontWeight: '700' },
  actionBtn: {
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  dangerBtn: { borderColor: '#FF4757' },
  actionBtnText: { color: '#fff', fontSize: 14 },
  dangerText: { color: '#FF4757' },
  disclaimer: {
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
    marginTop: 8,
  },
  pressed: { opacity: 0.6 },
});
