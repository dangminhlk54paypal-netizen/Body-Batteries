import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useSettingsStore } from '../store/settingsStore';
import { useEnergyStore } from '../store/energyStore';
import { passiveDailyBurn } from '../domain/energy/metabolismEngine';
import { validateUserProfile } from '../domain/energy/profileValidation';
import { PROFILE_LIMITS } from '../lib/metabolicConstants';
import type { OccupationLevel, Sex, UserProfile } from '../types/energy';

const SEX_LABELS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
];
const OCCUPATION_LABELS: { value: OccupationLevel; label: string }[] = [
  { value: 'sedentary', label: 'Ít vận động' },
  { value: 'light', label: 'Vừa' },
  { value: 'active', label: 'Nhiều' },
];

// Lets the user enter their body profile (used to size the energy battery).
export function BodyProfileCard() {
  const { userProfile, setUserProfile, currentMode } = useSettingsStore();

  const [weight, setWeight] = useState(String(userProfile.weightKg));
  const [height, setHeight] = useState(String(userProfile.heightCm));
  const [age, setAge] = useState(String(userProfile.age));
  const [sex, setSex] = useState<Sex>(userProfile.sex);
  const [occupation, setOccupation] = useState<OccupationLevel>(userProfile.occupation);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Live preview of the daily passive energy need from the current inputs.
  const preview: UserProfile = {
    weightKg: parseFloat(weight) || userProfile.weightKg,
    heightCm: parseFloat(height) || userProfile.heightCm,
    age: parseFloat(age) || userProfile.age,
    sex,
    occupation,
  };
  const tdee = passiveDailyBurn(preview);

  // Any edit invalidates the last save/error feedback so it doesn't go stale.
  function withReset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setError(null);
      setSaved(false);
    };
  }

  function handleSave() {
    const validationError = validateUserProfile(preview);
    if (validationError) {
      setError(validationError);
      setSaved(false);
      return;
    }
    setError(null);
    setUserProfile(preview);
    // Apply the new capacity to today's energy battery right away.
    useEnergyStore.getState().loadToday(currentMode);
    setSaved(true);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.explainer}>
        Đây là lượng năng lượng tối thiểu cơ thể bạn cần mỗi ngày để duy trì sự
        sống (thở, tim đập, tiêu hoá...) — chưa tính vận động. Công thức tính
        dựa trên đúng 4 số liệu dưới đây của BẠN, nên áp dụng đúng cho bất kỳ
        ai nhập đúng số của mình.
      </Text>

      <View style={styles.fieldRow}>
        <Field
          label={`Cân nặng (kg, ${PROFILE_LIMITS.weightKg.min}-${PROFILE_LIMITS.weightKg.max})`}
          value={weight}
          onChange={withReset(setWeight)}
        />
        <Field
          label={`Chiều cao (cm, ${PROFILE_LIMITS.heightCm.min}-${PROFILE_LIMITS.heightCm.max})`}
          value={height}
          onChange={withReset(setHeight)}
        />
        <Field
          label={`Tuổi (${PROFILE_LIMITS.age.min}-${PROFILE_LIMITS.age.max})`}
          value={age}
          onChange={withReset(setAge)}
        />
      </View>

      <Text style={styles.fieldLabel}>Giới tính</Text>
      <View style={styles.chipRow}>
        {SEX_LABELS.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => withReset(setSex)(o.value)}
            style={({ pressed }) => [
              styles.chip,
              sex === o.value && styles.chipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipText, sex === o.value && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Mức vận động công việc/lối sống</Text>
      <View style={styles.chipRow}>
        {OCCUPATION_LABELS.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => withReset(setOccupation)(o.value)}
            style={({ pressed }) => [
              styles.chip,
              occupation === o.value && styles.chipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipText, occupation === o.value && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.tdee}>
        Nhu cầu năng lượng ước tính: <Text style={styles.tdeeValue}>{tdee} kcal/ngày</Text>
      </Text>

      {error && <Text style={styles.errorText}>⚠️ {error}</Text>}
      {saved && !error && <Text style={styles.savedText}>✅ Đã lưu hồ sơ.</Text>}

      <Pressable
        style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
        onPress={handleSave}
      >
        <Text style={styles.saveText}>Lưu hồ sơ</Text>
      </Pressable>
    </View>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholderTextColor="#666" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, gap: 12 },
  fieldRow: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, gap: 6 },
  fieldLabel: { fontSize: 12, color: '#888' },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#444',
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#26263d',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#444',
  },
  chipActive: { backgroundColor: '#00B894', borderColor: '#00B894' },
  chipText: { color: '#aaa', fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  tdee: { color: '#aaa', fontSize: 13, marginTop: 4 },
  tdeeValue: { color: '#00B894', fontWeight: '700' },
  explainer: { color: '#888', fontSize: 12, lineHeight: 17 },
  errorText: { color: '#FF4757', fontSize: 13 },
  savedText: { color: '#00B894', fontSize: 13 },
  saveBtn: { backgroundColor: '#00B894', padding: 14, borderRadius: 12, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
