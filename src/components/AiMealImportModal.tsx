import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useEnergyStore } from '../store/energyStore';
import { parseAiMealLog, aiLineToFoodItem, timestampForLine } from '../domain/food/aiMealLog';
import { AI_PLATFORMS, MEAL_LOG_PROMPT, NEW_FOOD_PROMPT, FIX_FORMAT_PROMPT } from '../lib/aiPrompts';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// "Nhờ AI ghi món": copy a prompt → chat with any AI → paste its BB-LOG v1
// block back here → each line is logged through the normal logFood path.
export function AiMealImportModal({ visible, onClose }: Props) {
  const logFood = useEnergyStore((s) => s.logFood);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => parseAiMealLog(text), [text]);
  const totalKcal = parsed.items.reduce((s, i) => s + i.energyKcal, 0);

  async function copy(label: string, value: string) {
    await Clipboard.setStringAsync(value);
    setCopied(label);
    setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
  }

  async function paste() {
    const v = await Clipboard.getStringAsync();
    if (v) setText(v);
  }

  async function confirm() {
    if (parsed.items.length === 0 || saving) return;
    setSaving(true);
    for (const line of parsed.items) {
      await logFood(aiLineToFoodItem(line), line.grams, timestampForLine(line));
    }
    setSaving(false);
    setText('');
    onClose();
  }

  function close() {
    setText('');
    onClose();
  }

  const CopyBtn = ({ label, value }: { label: string; value: string }) => (
    <Pressable
      style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
      onPress={() => copy(label, value)}
    >
      <Text style={styles.copyText}>{copied === label ? '✓ Đã copy' : `📋 ${label}`}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>🤖 Nhờ AI ghi món</Text>

            <Text style={styles.step}>1. Copy prompt</Text>
            <View style={styles.row}>
              <CopyBtn label="Ghi bữa ăn" value={MEAL_LOG_PROMPT} />
              <CopyBtn label="Sửa định dạng" value={FIX_FORMAT_PROMPT} />
            </View>

            <Text style={styles.step}>2. Dán vào AI, viết thêm lời kể của bạn rồi gửi</Text>
            <View style={styles.chips}>
              {AI_PLATFORMS.map((p) => (
                <Pressable
                  key={p.name}
                  style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                  onPress={() => Linking.openURL(p.url)}
                >
                  <Text style={styles.chipText}>{p.name} ↗</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>Vd: "Sáng ăn bánh mì trứng, trưa 1 tô phở bò lớn". Gửi kèm ảnh món cũng được.</Text>

            <Text style={styles.step}>3. Dán kết quả AI trả về</Text>
            <TextInput
              style={styles.input}
              multiline
              placeholder={'BB-LOG v1\n12:00 | Phở bò | 600 | 550 | 30 | 70 | 15 | 450'}
              placeholderTextColor="#666"
              value={text}
              onChangeText={setText}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <Pressable style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]} onPress={paste}>
              <Text style={styles.copyText}>📥 Dán từ clipboard</Text>
            </Pressable>

            {parsed.items.length > 0 && (
              <View style={styles.preview}>
                {parsed.items.map((i, idx) => (
                  <Text key={idx} style={styles.previewLine}>
                    {String(i.hour).padStart(2, '0')}:{String(i.minute).padStart(2, '0')} · {i.name} · {i.grams} g ·{' '}
                    {Math.round(i.energyKcal)} kcal
                  </Text>
                ))}
                <Text style={styles.previewTotal}>Tổng: {Math.round(totalKcal)} kcal</Text>
              </View>
            )}
            {parsed.errors.map((e, idx) => (
              <Text key={idx} style={styles.error}>⚠️ {e}</Text>
            ))}

            <Text style={styles.hint}>Món chưa có trong danh sách? Copy prompt này để tạo dữ liệu món mới (dành cho file food_items.csv):</Text>
            <CopyBtn label="Tạo món mới (CSV)" value={NEW_FOOD_PROMPT} />

            <Text style={styles.hint}>⚠️ Số liệu AI là ước lượng — xem lại trước khi lưu.</Text>
          </ScrollView>

          <View style={[styles.row, styles.footer]}>
            <Pressable style={({ pressed }) => [styles.modalBtn, styles.cancel, pressed && styles.pressed]} onPress={close}>
              <Text style={styles.cancelText}>Huỷ</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.modalBtn,
                styles.ok,
                (parsed.items.length === 0 || saving) && styles.disabled,
                pressed && styles.pressed,
              ]}
              onPress={confirm}
              disabled={parsed.items.length === 0 || saving}
            >
              <Text style={styles.okText}>
                {saving ? 'Đang lưu…' : `Ghi ${parsed.items.length} món ⚡`}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  content: { padding: 24, gap: 10 },
  title: { fontSize: 20, fontWeight: '700', color: '#fff' },
  step: { fontSize: 15, fontWeight: '700', color: '#fff', marginTop: 6 },
  hint: { fontSize: 12, color: '#999' },
  row: { flexDirection: 'row', gap: 10 },
  copyBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderWidth: 1,
    borderColor: '#6c5ce7',
  },
  copyText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#2d2d44',
    borderWidth: 1,
    borderColor: '#444',
  },
  chipText: { color: '#ccc', fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    padding: 12,
    minHeight: 110,
    fontSize: 13,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#444',
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  preview: { backgroundColor: '#22223a', borderRadius: 10, padding: 12, gap: 4 },
  previewLine: { color: '#ddd', fontSize: 13 },
  previewTotal: { color: '#00B894', fontSize: 14, fontWeight: '700', marginTop: 4 },
  error: { color: '#ff7675', fontSize: 12 },
  footer: { padding: 16, paddingBottom: 28, borderTopWidth: 1, borderTopColor: '#2d2d44' },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancel: { backgroundColor: '#2d2d44' },
  cancelText: { color: '#aaa', fontSize: 15, fontWeight: '600' },
  ok: { backgroundColor: '#6c5ce7' },
  okText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
