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
import { exportWeeklyData, exportMonthlyData } from '../services/export/excelExportService';
import { runWeeklyCleanup } from '../services/cleanup/cleanupService';
import {
  requestNotificationPermission,
  scheduleDailyReminder,
  cancelAllNotifications,
} from '../services/notifications/notificationService';
import type { MealWindow } from '../lib/constants';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );
}

// ─── Hour stepper (shared between reminder time & meal windows) ────────────────
function HourStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (delta: number) => void;
}) {
  return (
    <View style={styles.stepperGroup}>
      <Pressable
        style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
        onPress={() => onChange(-1)}
      >
        <Text style={styles.stepperBtnText}>−</Text>
      </Pressable>
      <Text style={styles.timeValue}>{pad(value)}</Text>
      <Pressable
        style={({ pressed }) => [styles.stepperBtn, pressed && styles.pressed]}
        onPress={() => onChange(1)}
      >
        <Text style={styles.stepperBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

// ─── Meal window row ──────────────────────────────────────────────────────────
function MealWindowRow({
  label,
  color,
  window,
  onChangeStart,
  onChangeEnd,
}: {
  label: string;
  color: string;
  window: MealWindow;
  onChangeStart: (delta: number) => void;
  onChangeEnd: (delta: number) => void;
}) {
  const overlapping = window.startHour >= window.endHour;
  return (
    <View style={styles.mealRow}>
      <View style={styles.mealLabelWrap}>
        <View style={[styles.mealDot, { backgroundColor: color }]} />
        <Text style={styles.mealLabel}>{label}</Text>
      </View>
      <View style={styles.mealSteppers}>
        <HourStepper value={window.startHour} onChange={onChangeStart} />
        <Text style={styles.mealArrow}>→</Text>
        <HourStepper value={window.endHour} onChange={onChangeEnd} />
        <Text style={styles.mealUnit}>h</Text>
      </View>
      {overlapping && (
        <Text style={styles.mealWarning}>⚠ Giờ bắt đầu phải nhỏ hơn giờ kết thúc</Text>
      )}
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export function SettingsScreen() {
  const {
    notificationsEnabled,
    setNotificationsEnabled,
    lowBatteryThreshold,
    setLowBatteryThreshold,
    reminderHour,
    reminderMinute,
    setReminderTime,
    mealWindows,
    setMealWindow,
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

  function handleMealWindowChange(
    meal: 'breakfast' | 'lunch' | 'dinner',
    field: 'startHour' | 'endHour',
    delta: number
  ) {
    const current = mealWindows[meal];
    const newVal = (current[field] + delta + 24) % 24;
    setMealWindow(meal, { ...current, [field]: newVal });
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

  async function handleExportMonthly() {
    setExporting(true);
    try {
      await exportMonthlyData();
    } catch {
      Alert.alert('Lỗi', 'Không thể xuất file. Thử lại sau.');
    } finally {
      setExporting(false);
    }
  }

  function handleCleanup() {
    Alert.alert(
      'Xoá dữ liệu cũ',
      'Dữ liệu hơn 35 ngày sẽ bị xoá VĨNH VIỄN và không thể khôi phục.\n\nHãy bấm "Xuất Excel" trước để giữ lại bản lưu. Bạn có chắc muốn xoá?',
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

  const mealConfig: {
    key: 'breakfast' | 'lunch' | 'dinner';
    label: string;
    color: string;
  }[] = [
    { key: 'breakfast', label: 'Bữa sáng', color: '#FFB347' },
    { key: 'lunch', label: 'Bữa trưa', color: '#00B894' },
    { key: 'dinner', label: 'Bữa tối', color: '#6C5CE7' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Page title */}
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Cài đặt</Text>
          <Text style={styles.subtitle}>Tuỳ chỉnh theo thói quen của bạn</Text>
        </View>

        <View style={styles.divider} />

        {/* ── Body profile ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader icon="🧬" label="HỒ SƠ CƠ THỂ" />
          <Text style={styles.sectionDesc}>
            Dùng để tính nhu cầu năng lượng (pin Năng lượng). Chỉ tham khảo — không phải tư vấn y tế.
          </Text>
          <BodyProfileCard />
        </View>

        <View style={styles.divider} />

        {/* ── Notifications ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader icon="🔔" label="THÔNG BÁO" />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Bật thông báo</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ true: '#00B894' }}
            />
          </View>

          <Text style={styles.sectionDesc}>Giờ nhắc nhở cập nhật năng lượng mỗi ngày</Text>
          <View style={styles.timeRow}>
            <HourStepper
              value={reminderHour}
              onChange={handleReminderHourChange}
            />
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

          {/* Low battery threshold moved here — logically related to notifications */}
          <Text style={[styles.sectionDesc, { marginTop: 8 }]}>
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

        <View style={styles.divider} />

        {/* ── Meal windows ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader icon="🕐" label="KHUNG GIỜ BỮA ĂN" />
          <Text style={styles.sectionDesc}>
            App tự xếp món ăn vào bữa sáng/trưa/tối theo giờ bạn ghi. Ngoài khung giờ = Bữa phụ.
          </Text>
          <View style={styles.mealWindowCard}>
            {mealConfig.map(({ key, label, color }, idx) => (
              <View key={key}>
                {idx > 0 && <View style={styles.mealDivider} />}
                <MealWindowRow
                  label={label}
                  color={color}
                  window={mealWindows[key]}
                  onChangeStart={(d) => handleMealWindowChange(key, 'startHour', d)}
                  onChangeEnd={(d) => handleMealWindowChange(key, 'endHour', d)}
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── Data actions ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader icon="💾" label="DỮ LIỆU" />

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
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            onPress={handleExportMonthly}
            disabled={exporting}
          >
            <Text style={styles.actionBtnText}>
              {exporting ? 'Đang xuất...' : '📊 Xuất Excel 30 ngày gần nhất'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.dangerBtn, pressed && styles.pressed]}
            onPress={handleCleanup}
          >
            <Text style={[styles.actionBtnText, styles.dangerText]}>
              🗑️ Xoá dữ liệu cũ hơn 35 ngày
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
  scroll: { padding: 20, paddingBottom: 48 },

  // ── Title ──────────────────────────────────────────────────────────────────
  titleWrap: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 13, color: '#555', marginTop: 2 },

  // ── Divider ────────────────────────────────────────────────────────────────
  divider: { height: 1, backgroundColor: '#1e1e30', marginVertical: 20 },

  // ── Section ────────────────────────────────────────────────────────────────
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionIcon: { fontSize: 14 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 1.5 },
  sectionDesc: { fontSize: 13, color: '#666', lineHeight: 18 },

  // ── Switch row ─────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 12,
  },
  rowLabel: { fontSize: 15, color: '#fff' },

  // ── Chips ──────────────────────────────────────────────────────────────────
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

  // ── Reminder time row ──────────────────────────────────────────────────────
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 12,
  },
  timeColon: { color: '#fff', fontSize: 20, fontWeight: '700' },

  // ── Stepper (shared) ───────────────────────────────────────────────────────
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

  // ── Meal window card ───────────────────────────────────────────────────────
  mealWindowCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#262640',
    overflow: 'hidden',
  },
  mealRow: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  mealDivider: { height: 1, backgroundColor: '#26263d' },
  mealLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mealDot: { width: 8, height: 8, borderRadius: 4 },
  mealLabel: { fontSize: 14, color: '#ccc', fontWeight: '600', width: 76 },
  mealSteppers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  mealArrow: { color: '#555', fontSize: 16, marginHorizontal: 2 },
  mealUnit: { color: '#555', fontSize: 13 },
  mealWarning: { fontSize: 11, color: '#FF6B6B', marginTop: 2 },

  // ── Action buttons ────────────────────────────────────────────────────────
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

  // ── Disclaimer ────────────────────────────────────────────────────────────
  disclaimer: {
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
    marginTop: 16,
  },

  pressed: { opacity: 0.6 },
});
