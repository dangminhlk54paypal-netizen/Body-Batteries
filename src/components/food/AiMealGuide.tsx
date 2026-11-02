// "🤖 Nhờ AI ghi món": copy a ready prompt, open any AI chat, paste its answer
// back into the Nạp bằng chữ box. Shown in place of that box — the answer then
// goes through the same review rows as everything else (parseMealAnswer).
import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { BB_LOG_HEADER } from '../../domain/food/aiImport/bbLog';
import type { ThemeColors } from '../../lib/theme';
import { useThemedStyles } from '../../hooks/useThemeColors';
import { useT } from '../../i18n/useT';

const AI_PLATFORMS: { name: string; url: string }[] = [
  { name: 'ChatGPT', url: 'https://chatgpt.com' },
  { name: 'Claude', url: 'https://claude.ai' },
  { name: 'Gemini', url: 'https://gemini.google.com' },
  { name: 'Copilot', url: 'https://copilot.microsoft.com' },
  { name: 'DeepSeek', url: 'https://chat.deepseek.com' },
];

// The CSV columns of a new food (as food_items.csv): read by name, never translated.
const FOOD_CSV_COLUMNS =
  'id,name_vi,name_en,category,default_serving_g,serving_presets,energy_kcal,water_g,protein_g,fat_g,carb_g,fiber_g,sugar_g,calcium_mg,iron_mg,sodium_mg,potassium_mg,magnesium_mg,zinc_mg,source,note';

export function AiMealGuide({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const styles = useThemedStyles(createStyles);
  const [copied, setCopied] = useState<string | null>(null);

  const prompts = [
    { key: 'meal', text: t('components.aiMealGuide.mealPrompt', { header: BB_LOG_HEADER }) },
    { key: 'fix', text: t('components.aiMealGuide.fixPrompt') },
    { key: 'food', text: t('components.aiMealGuide.foodPrompt', { columns: FOOD_CSV_COLUMNS }) },
  ];

  async function copy(key: string, text: string) {
    await Clipboard.setStringAsync(text);
    setCopied(key);
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t('components.aiMealGuide.title')}</Text>
      <Text style={styles.step}>{t('components.aiMealGuide.stepCopy')}</Text>
      <View style={styles.row}>
        {prompts.map((p) => (
          <Pressable
            key={p.key}
            style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
            onPress={() => copy(p.key, p.text)}
          >
            <Text style={styles.copyText} numberOfLines={2} adjustsFontSizeToFit>
              {copied === p.key ? t('components.aiMealGuide.copied') : t(`components.aiMealGuide.copy.${p.key}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.step}>{t('components.aiMealGuide.stepChat')}</Text>
      <View style={styles.chips}>
        {AI_PLATFORMS.map((p) => (
          <Pressable
            key={p.name}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            onPress={() => Linking.openURL(p.url).catch(() => {})}
          >
            <Text style={styles.chipText}>{p.name} ↗</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.step}>{t('components.aiMealGuide.stepPaste')}</Text>
      <Text style={styles.note}>{t('components.aiMealGuide.estimateNote')}</Text>
      <Pressable style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} onPress={onBack}>
        <Text style={styles.backText}>{t('components.aiMealGuide.back')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    content: { gap: 10, paddingBottom: 12 },
    title: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
    step: { fontSize: 13, fontWeight: '600', color: c.textPrimary },
    note: { fontSize: 12, color: c.textMuted },
    row: { flexDirection: 'row', gap: 8 },
    copyBtn: {
      flex: 1,
      minHeight: 44,
      paddingHorizontal: 6,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgElevated,
    },
    copyText: { fontSize: 12, fontWeight: '600', color: c.textPrimary, textAlign: 'center' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, backgroundColor: c.bgElevated },
    chipText: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
    backBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: c.accent },
    backText: { fontSize: 14, fontWeight: '700', color: c.onAccent },
    pressed: { opacity: 0.6 },
  });
