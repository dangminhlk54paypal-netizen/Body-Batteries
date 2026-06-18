import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView } from 'react-native';
import { BodyProfileCard } from '../components/BodyProfileCard';

interface OnboardingScreenProps {
  onDone: () => void;
}

// First-launch welcome screen. Lets the user set their real body profile
// (the app ships with placeholder age/sex/weight/height) before they start
// using the energy battery, so the daily energy budget is accurate from day one.
export function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>⚡ Chào mừng đến với My Body Batteries</Text>
        <Text style={styles.intro}>
          App giúp bạn theo dõi "pin năng lượng" của cơ thể mỗi ngày — pin sẽ
          hao dần theo thời gian và hoạt động, giống như pin điện thoại.{'\n\n'}
          Để tính đúng dung lượng pin của BẠN, hãy nhập đúng thông tin cơ thể
          dưới đây (cân nặng, chiều cao, tuổi, giới tính).
        </Text>

        <BodyProfileCard />

        <Text style={styles.disclaimer}>
          Chỉ tham khảo — không phải thiết bị y tế
        </Text>

        <Pressable style={styles.startBtn} onPress={onDone}>
          <Text style={styles.startText}>Bắt đầu dùng app</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 32,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  intro: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  disclaimer: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  startBtn: {
    backgroundColor: '#00B894',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  startText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
