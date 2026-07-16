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
import { colors } from '../lib/theme';
import { useT } from '../i18n/useT';
import { LOCALE_TAGS } from '../i18n/types';

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
  const { t, language } = useT();
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

    const alertTitle = t('screens.diary.saveTitle');
    const alertMessage = hasSavedToday
      ? t('screens.diary.saveMessageAppend')
      : t('screens.diary.saveMessageNew');

    Alert.alert(
      alertTitle,
      alertMessage,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('screens.diary.saveConfirmButton'),
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
                    const timeStr = now.toLocaleTimeString(LOCALE_TAGS[language], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    finalOutput =
                      decryptedPrev +
                      t('screens.diary.appendEntry', { time: timeStr, text: text.trim() });
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
              Alert.alert(t('common.error'), t('screens.diary.saveError'));
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
          <ActivityIndicator size="large" color={colors.accentAlt} />
          <Text style={styles.loadingText}>{t('screens.diary.loadingText')}</Text>
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
              <Text style={styles.title}>{t('screens.diary.title')}</Text>
              <Text style={styles.date}>📅 {formatDisplayDate(todayString(), language)}</Text>
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
                {hasSavedToday ? t('screens.diary.badgeSaved') : t('screens.diary.badgeNew')}
              </Text>
            </View>
          </View>

          <View style={styles.lockBox}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.lockText}>
              {t('screens.diary.lockLine1')}
              {'\n'}
              <Text style={{ fontWeight: '600', color: colors.accentAltLighter }}>
                {t('screens.diary.lockLine2Bold')}
              </Text>
            </Text>
          </View>

          {saved ? (
            <View style={styles.savedBox}>
              <View style={styles.successCard}>
                <Text style={styles.successIcon}>🛡️</Text>
                <Text style={styles.successTitle}>{t('screens.diary.savedTitle')}</Text>
                <Text style={styles.successSubtitle}>{t('screens.diary.savedSubtitle')}</Text>
              </View>
              <View style={styles.actionButtons}>
                <Pressable
                  onPress={() => setSaved(false)}
                  style={({ pressed }) => [styles.newEntryBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.newEntryText}>{t('screens.diary.writeMoreButton')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate('History')}
                  style={({ pressed }) => [styles.historyBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.historyText}>{t('screens.diary.viewHistoryButton')}</Text>
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
                  placeholder={t('screens.diary.placeholder')}
                  placeholderTextColor={colors.textSubtle}
                  value={text}
                  onChangeText={setText}
                  textAlignVertical="top"
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
                <Text style={styles.charCount}>
                  {t('screens.diary.charCount', { n: text.length })}
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
                  {hasSavedToday
                    ? t('screens.diary.saveButtonAppend')
                    : t('screens.diary.saveButtonNew')}
                </Text>
              </Pressable>
            </>
          )}

          <Text style={styles.disclaimer}>{t('screens.diary.disclaimer')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.textTertiary,
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
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  date: {
    fontSize: 13,
    color: colors.textTertiary,
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
    color: colors.accent,
  },
  badgeTextNew: {
    color: colors.accentAltLight,
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
    color: colors.accentAltLight,
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 18,
    fontSize: 16,
    color: colors.textPrimary,
    minHeight: 220,
    borderWidth: 1,
    borderColor: colors.bgElevated,
    lineHeight: 26,
  },
  inputFocused: {
    borderColor: colors.accentAlt,
  },
  charCount: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    fontSize: 12,
    color: colors.textMuted,
  },
  saveBtn: {
    backgroundColor: colors.accentAlt,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.35,
  },
  saveBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  savedBox: {
    gap: 20,
    alignItems: 'stretch',
  },
  successCard: {
    backgroundColor: colors.bgCard,
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
    color: colors.textPrimary,
  },
  successSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  actionButtons: {
    gap: 12,
  },
  newEntryBtn: {
    backgroundColor: colors.accentAlt,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  newEntryText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  historyBtn: {
    backgroundColor: colors.bgCard,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  historyText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 10,
  },
  pressed: {
    opacity: 0.75,
  },
});
