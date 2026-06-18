import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useEnergyStore } from '../store/energyStore';
import { MET_TABLE } from '../lib/metabolicConstants';
import { FoodLogModal } from './FoodLogModal';
import type { ActivityType } from '../types/energy';

// Vietnamese labels for the MET-based activity types.
const ACTIVITY_LABELS: Record<ActivityType, string> = {
  walking: 'Đi bộ',
  brisk_walking: 'Đi nhanh',
  running: 'Chạy bộ',
  cycling: 'Đạp xe',
  swimming: 'Bơi',
  football: 'Đá bóng',
  basketball: 'Bóng rổ',
  badminton: 'Cầu lông',
  tennis: 'Tennis',
  gym_strength: 'Gym tạ',
  hiit: 'HIIT',
  yoga: 'Yoga',
};
const ACTIVITY_TYPES = Object.keys(MET_TABLE) as ActivityType[];

// How far below its resting position a bottom sheet starts before sliding
// up. Kept local to this file since both inline modals below use it.
const SHEET_OFFSET = 400;

function useSheetSlide(visible: boolean) {
  const translateY = useSharedValue(SHEET_OFFSET);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : SHEET_OFFSET, { duration: 280 });
  }, [visible]);

  return useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
}

export function EnergyActionsBar() {
  const addCalories = useEnergyStore((s) => s.addCalories);
  const logActivity = useEnergyStore((s) => s.logActivity);

  const [foodOpen, setFoodOpen] = useState(false);
  const [calorieOpen, setCalorieOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const calorieSheetStyle = useSheetSlide(calorieOpen);
  const activitySheetStyle = useSheetSlide(activityOpen);

  const [kcal, setKcal] = useState('');
  const [activity, setActivity] = useState<ActivityType>('running');
  const [minutes, setMinutes] = useState('');
  const [steps, setSteps] = useState('');

  function confirmCalories() {
    const v = parseFloat(kcal);
    if (!isNaN(v) && v > 0) addCalories(v);
    setKcal('');
    setCalorieOpen(false);
  }

  function confirmActivity() {
    const mins = parseFloat(minutes);
    const stepCount = parseFloat(steps);
    logActivity({
      steps: !isNaN(stepCount) && stepCount > 0 ? stepCount : 0,
      workouts: !isNaN(mins) && mins > 0 ? [{ type: activity, minutes: mins }] : [],
    });
    setMinutes('');
    setSteps('');
    setActivityOpen(false);
  }

  return (
    <View style={styles.container}>
      {/* Primary: log a food from the database (food_items.csv) */}
      <Pressable
        style={({ pressed }) => [styles.btn, styles.food, pressed && styles.pressed]}
        onPress={() => setFoodOpen(true)}
      >
        <Text style={styles.btnText}>🍱 Ghi món ăn (từ danh sách)</Text>
      </Pressable>

      {/* Manual fallbacks: kept as supplementary inputs */}
      <View style={styles.bar}>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.eat, pressed && styles.pressed]}
          onPress={() => setCalorieOpen(true)}
        >
          <Text style={styles.btnText}>🍽️ Ăn thêm (kcal)</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.move, pressed && styles.pressed]}
          onPress={() => setActivityOpen(true)}
        >
          <Text style={styles.btnText}>🏃 Vận động</Text>
        </Pressable>
      </View>

      <FoodLogModal visible={foodOpen} onClose={() => setFoodOpen(false)} />

      {/* Manual calories */}
      <Modal visible={calorieOpen} transparent animationType="fade" onRequestClose={() => setCalorieOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <Animated.View style={[styles.sheet, calorieSheetStyle]}>
            <Text style={styles.title}>Nạp năng lượng đã ăn</Text>
            <Text style={styles.subtitle}>Nhập số kcal bạn đã ăn (ngoài Protein/Carbs đã ghi)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ví dụ: 500"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
              value={kcal}
              onChangeText={setKcal}
              autoFocus
            />
            <View style={styles.row}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
                onPress={() => setCalorieOpen(false)}
              >
                <Text style={styles.cancelText}>Huỷ</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.eat, pressed && styles.pressed]}
                onPress={confirmCalories}
              >
                <Text style={styles.btnText}>Nạp ⚡</Text>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Activity / workout */}
      <Modal visible={activityOpen} transparent animationType="fade" onRequestClose={() => setActivityOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <Animated.View style={[styles.sheet, activitySheetStyle]}>
            <Text style={styles.title}>Ghi vận động</Text>
            <Text style={styles.subtitle}>Chọn môn + số phút (và/hoặc số bước chân)</Text>
            <View style={styles.chips}>
              {ACTIVITY_TYPES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setActivity(t)}
                  style={({ pressed }) => [
                    styles.chip,
                    activity === t && styles.chipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.chipText, activity === t && styles.chipTextActive]}>
                    {ACTIVITY_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Số phút tập (ví dụ: 45)"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
              value={minutes}
              onChangeText={setMinutes}
            />
            <TextInput
              style={styles.input}
              placeholder="Số bước chân (tuỳ chọn)"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
              value={steps}
              onChangeText={setSteps}
            />
            <View style={styles.row}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]}
                onPress={() => setActivityOpen(false)}
              >
                <Text style={styles.cancelText}>Huỷ</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.move, pressed && styles.pressed]}
                onPress={confirmActivity}
              >
                <Text style={styles.btnText}>Ghi 🔥</Text>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 10 },
  bar: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  food: { backgroundColor: '#0984e3' },
  eat: { backgroundColor: '#00B894' },
  move: { backgroundColor: '#FF6B6B' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 14, color: '#aaa' },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#444',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#2d2d44',
    borderWidth: 1,
    borderColor: '#444',
  },
  chipActive: { backgroundColor: '#FF6B6B', borderColor: '#FF6B6B' },
  chipText: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancel: { backgroundColor: '#2d2d44' },
  cancelText: { color: '#aaa', fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
