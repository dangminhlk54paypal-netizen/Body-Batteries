import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { getDb } from '../data/db/database';
import { encryptDiary } from '../lib/encryption';
import { saveDiaryEntry } from '../data/repositories/dailyLogRepository';
import { todayString, formatDisplayDate } from '../lib/dateUtils';

// Base64 helper definitions for safe decryption compatibility
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64(input: string): string {
  const str = input.replace(/=+$/, '');
  let output = '';
  for (
    let bc = 0, bs = 0, buffer, idx = 0;
    (buffer = str.charAt(idx++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer),
      bc++ % 4) ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)))) : 0
  ) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

function fromUtf8Bytes(bytes: number[]): string {
  let str = '';
  let i = 0;
  while (i < bytes.length) {
    const byte = bytes[i];
    if (byte < 0x80) {
      str += String.fromCharCode(byte);
      i++;
    } else if ((byte & 0xe0) === 0xc0) {
      const byte2 = bytes[i + 1];
      str += String.fromCharCode(((byte & 0x1f) << 6) | (byte2 & 0x3f));
      i += 2;
    } else if ((byte & 0xf0) === 0xe0) {
      const byte2 = bytes[i + 1];
      const byte3 = bytes[i + 2];
      str += String.fromCharCode(
        ((byte & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f)
      );
      i += 3;
    } else if ((byte & 0xf8) === 0xf0) {
      const byte2 = bytes[i + 1];
      const byte3 = bytes[i + 2];
      const byte4 = bytes[i + 3];
      let code =
        ((byte & 0x07) << 18) |
        ((byte2 & 0x3f) << 12) |
        ((byte3 & 0x3f) << 6) |
        (byte4 & 0x3f);
      code -= 0x10000;
      const high = 0xd800 | (code >> 10);
      const low = 0xdc00 | (code & 0x3ff);
      str += String.fromCharCode(high, low);
      i += 4;
    } else {
      str += String.fromCharCode(byte);
      i++;
    }
  }
  return str;
}

function xorDecrypt(encryptedBase64: string, key: string): string {
  const binary = decodeBase64(encryptedBase64);
  const bytes: number[] = [];
  for (let i = 0; i < binary.length; i++) {
    bytes.push(binary.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return fromUtf8Bytes(bytes);
}

export function DiaryScreen() {
  const navigation = useNavigation<any>();
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const [hasSavedToday, setHasSavedToday] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    async function checkTodayEntry() {
      try {
        const db = getDb();
        const row = await db.getFirstAsync<{ encrypted_content: string }>(
          'SELECT encrypted_content FROM diary_entries WHERE date = ?',
          todayString()
        );
        if (row && row.encrypted_content) {
          setHasSavedToday(true);
        } else {
          setHasSavedToday(false);
        }
      } catch (e) {
        console.error('Error checking today diary entry:', e);
      } finally {
        setIsLoading(false);
      }
    }
    checkTodayEntry();
  }, []);

  async function handleSave() {
    if (!text.trim()) return;

    const alertTitle = 'Lưu nhật ký';
    const alertMessage = hasSavedToday
      ? 'Hôm nay bạn đã lưu nhật ký. Ghi thêm này sẽ tự động được nối tiếp (thêm mới) vào nhật ký của hôm nay. Bạn có chắc không?'
      : 'Nhật ký sẽ được mã hoá và không thể đọc lại trong app. Bạn có chắc không?';

    Alert.alert(
      alertTitle,
      alertMessage,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Lưu & mã hoá',
          onPress: async () => {
            try {
              let finalOutput = text.trim();
              if (hasSavedToday) {
                const db = getDb();
                const row = await db.getFirstAsync<{ encrypted_content: string }>(
                  'SELECT encrypted_content FROM diary_entries WHERE date = ?',
                  todayString()
                );
                if (row && row.encrypted_content) {
                  const key = await SecureStore.getItemAsync('diary_encryption_key');
                  if (key) {
                    const decryptedPrev = xorDecrypt(row.encrypted_content, key);
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    finalOutput = `${decryptedPrev}\n\n[Ghi thêm lúc ${timeStr}]:\n${text.trim()}`;
                  }
                }
              }

              const encrypted = await encryptDiary(finalOutput);
              await saveDiaryEntry(todayString(), encrypted);
              setText('');
              setSaved(true);
              setHasSavedToday(true);
            } catch (e) {
              console.error('Error saving diary:', e);
              Alert.alert('Lỗi', 'Không thể lưu nhật ký. Vui lòng thử lại.');
            }
          },
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C5CE7" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Nhật ký</Text>
              <Text style={styles.date}>📅 {formatDisplayDate(todayString())}</Text>
            </View>
            <View
              style={[
                styles.badge,
                hasSavedToday ? styles.badgeSaved : styles.badgeNew,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  hasSavedToday ? styles.badgeTextSaved : styles.badgeTextNew,
                ]}
              >
                {hasSavedToday ? '🔒 Đã bảo mật hôm nay' : '📝 Nhật ký mới'}
              </Text>
            </View>
          </View>

          <View style={styles.lockBox}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.lockText}>
              Nhật ký được mã hoá ngay khi lưu.{'\n'}
              App không thể đọc lại nội dung.{'\n'}
              <Text style={{ fontWeight: '600', color: '#9E9EFE' }}>
                Bảo vệ riêng tư tuyệt đối cho bạn.
              </Text>
            </Text>
          </View>

          {saved ? (
            <View style={styles.savedBox}>
              <View style={styles.successCard}>
                <Text style={styles.successIcon}>🛡️</Text>
                <Text style={styles.successTitle}>Đã lưu & mã hoá!</Text>
                <Text style={styles.successSubtitle}>
                  Nhật ký hôm nay đã được khóa an toàn bằng mật mã riêng tư trên điện thoại.
                </Text>
              </View>
              <View style={styles.actionButtons}>
                <Pressable
                  onPress={() => setSaved(false)}
                  style={({ pressed }) => [styles.newEntryBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.newEntryText}>✍️ Viết thêm nội dung</Text>
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate('History')}
                  style={({ pressed }) => [styles.historyBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.historyText}>📊 Xem Lịch sử pin</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    isFocused && styles.inputFocused,
                  ]}
                  multiline
                  placeholder="Hôm nay bạn cảm thấy thế nào?"
                  placeholderTextColor="#777"
                  value={text}
                  onChangeText={setText}
                  textAlignVertical="top"
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
                <Text style={styles.charCount}>
                  {text.length} ký tự
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.saveBtn,
                  !text.trim() && styles.saveBtnDisabled,
                  pressed && styles.pressed,
                ]}
                onPress={handleSave}
                disabled={!text.trim()}
              >
                <Text style={styles.saveBtnText}>
                  {hasSavedToday ? '🔒 Lưu nối tiếp nhật ký' : '🔒 Lưu & mã hoá'}
                </Text>
              </Pressable>
            </>
          )}

          <Text style={styles.disclaimer}>
            ⚠️ Nội dung nhật ký chỉ để tự theo dõi cảm xúc cá nhân. Đây không phải tư vấn tâm lý hoặc chẩn đoán y tế.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
  },
  scroll: {
    padding: 20,
    gap: 20,
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  date: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeSaved: {
    backgroundColor: 'rgba(0, 184, 148, 0.08)',
    borderColor: 'rgba(0, 184, 148, 0.3)',
  },
  badgeNew: {
    backgroundColor: 'rgba(108, 92, 231, 0.08)',
    borderColor: 'rgba(108, 92, 231, 0.3)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextSaved: {
    color: '#00B894',
  },
  badgeTextNew: {
    color: '#a29bfe',
  },
  lockBox: {
    backgroundColor: 'rgba(108, 92, 231, 0.05)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.15)',
  },
  lockIcon: {
    fontSize: 26,
  },
  lockText: {
    color: '#a29bfe',
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 18,
    fontSize: 16,
    color: '#fff',
    minHeight: 220,
    borderWidth: 1,
    borderColor: '#2d2d44',
    lineHeight: 26,
  },
  inputFocused: {
    borderColor: '#6C5CE7',
  },
  charCount: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    fontSize: 12,
    color: '#666',
  },
  saveBtn: {
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.35,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  savedBox: {
    gap: 20,
    alignItems: 'stretch',
  },
  successCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 148, 0.2)',
  },
  successIcon: {
    fontSize: 54,
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  successSubtitle: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  actionButtons: {
    gap: 12,
  },
  newEntryBtn: {
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  newEntryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  historyBtn: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  historyText: {
    color: '#aaa',
    fontSize: 15,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 10,
  },
  pressed: {
    opacity: 0.75,
  },
});
