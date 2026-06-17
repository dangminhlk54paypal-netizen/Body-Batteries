import React, { useState } from 'react';
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
import { exportWeeklyData } from '../services/export/excelExportService';
import { runWeeklyCleanup } from '../services/cleanup/cleanupService';

export function SettingsScreen() {
  const {
    notificationsEnabled,
    setNotificationsEnabled,
    lowBatteryThreshold,
    setLowBatteryThreshold,
  } = useSettingsStore();

  const [exporting, setExporting] = useState(false);

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

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>THÔNG BÁO</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Bật thông báo</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ true: '#00B894' }}
            />
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
                style={[
                  styles.chip,
                  lowBatteryThreshold === t && styles.chipActive,
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

          <Pressable style={styles.actionBtn} onPress={handleExport} disabled={exporting}>
            <Text style={styles.actionBtnText}>
              {exporting ? 'Đang xuất...' : '📊 Xuất Excel 7 ngày gần nhất'}
            </Text>
          </Pressable>

          <Pressable style={[styles.actionBtn, styles.dangerBtn]} onPress={handleCleanup}>
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
});
