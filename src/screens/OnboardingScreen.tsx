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
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Chào mừng đến với{'\n'}My Body Batteries ⚡</Text>
          <Text style={styles.intro}>
            Theo dõi mức năng lượng nạp vào và tiêu hao mỗi ngày, giúp bạn hiểu rõ cơ thể mình hơn.
          </Text>

          <View style={styles.cardSection}>
            <Text style={styles.cardHeader}>Hãy cho app biết một chút về bạn nhé!</Text>
            <BodyProfileCard />
            <Text style={styles.disclaimer}>
              Chỉ để tính toán năng lượng tham khảo — không phải thiết bị y tế.
            </Text>
          </View>
        </ScrollView>
        
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [styles.startBtn, pressed && styles.pressed]}
            onPress={onDone}
          >
            <Text style={styles.startText}>Bắt đầu dùng app</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    gap: 24,
    paddingBottom: 40,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 36,
  },
  intro: {
    color: '#aaa',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  cardSection: {
    marginTop: 10,
    gap: 12,
  },
  cardHeader: {
    color: '#E0E0FF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  disclaimer: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  footer: {
    padding: 24,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#0d0d1a',
  },
  startBtn: {
    backgroundColor: '#00B894',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#00B894',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
});
