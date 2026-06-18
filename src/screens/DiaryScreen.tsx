import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { encryptDiary } from '../lib/encryption';
import { saveDiaryEntry } from '../data/repositories/dailyLogRepository';
import { todayString, formatDisplayDate } from '../lib/dateUtils';

export function DiaryScreen() {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!text.trim()) return;

    Alert.alert(
      'Lưu nhật ký',
      'Nhật ký sẽ được mã hoá và không thể đọc lại trong app. Bạn có chắc không?',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Lưu & mã hoá',
          onPress: async () => {
            const encrypted = await encryptDiary(text.trim());
            await saveDiaryEntry(todayString(), encrypted);
            setText('');
            setSaved(true);
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Nhật ký</Text>
          <Text style={styles.date}>{formatDisplayDate(todayString())}</Text>

          <View style={styles.lockBox}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.lockText}>
              Nhật ký được mã hoá ngay khi lưu.{'\n'}
              App không thể đọc lại nội dung.
            </Text>
          </View>

          {saved ? (
            <View style={styles.savedBox}>
              <Text style={styles.savedText}>✅ Đã lưu và mã hoá thành công!</Text>
              <Pressable
                onPress={() => setSaved(false)}
                style={({ pressed }) => [styles.newEntryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.newEntryText}>Viết thêm</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                multiline
                placeholder="Hôm nay bạn cảm thấy thế nào?"
                placeholderTextColor="#555"
                value={text}
                onChangeText={setText}
                textAlignVertical="top"
              />
              <Pressable
                style={({ pressed }) => [
                  styles.saveBtn,
                  !text.trim() && styles.saveBtnDisabled,
                  pressed && styles.pressed,
                ]}
                onPress={handleSave}
                disabled={!text.trim()}
              >
                <Text style={styles.saveBtnText}>🔒 Lưu & mã hoá</Text>
              </Pressable>
            </>
          )}

          <Text style={styles.disclaimer}>
            ⚠️ Nội dung nhật ký chỉ để tự theo dõi cảm xúc cá nhân.
            Đây không phải tư vấn tâm lý.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  scroll: { padding: 20, gap: 16, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff' },
  date: { fontSize: 14, color: '#888' },
  lockBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  lockIcon: { fontSize: 24 },
  lockText: { color: '#888', fontSize: 13, lineHeight: 19, flex: 1 },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#2d2d44',
    lineHeight: 24,
  },
  saveBtn: {
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  savedBox: { gap: 12 },
  savedText: { color: '#00B894', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  newEntryBtn: {
    backgroundColor: '#1a1a2e',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  newEntryText: { color: '#aaa', fontSize: 14 },
  disclaimer: { fontSize: 11, color: '#444', lineHeight: 17 },
  pressed: { opacity: 0.6 },
});
